const mysql = require("mysql2/promise");

class Database {
  // --- Construtor ---
  constructor() {
    this.connection = null;
  }

  // --- Inicializa o banco de dados ---
  async init() {
    // Preferir variáveis de ambiente, com defaults seguros
    const connectionConfig = {
      host: process.env.MYSQL_HOST || "127.0.0.1",
      user: process.env.MYSQL_USER || "root",
      database: process.env.MYSQL_DATABASE || "n8n_workflows",
      port: parseInt(process.env.MYSQL_PORT || "3306", 10),
    };

    const envPassword = process.env.MYSQL_PASSWORD;

    try {
      // 1) Tenta conectar com senha (se fornecida)
      console.log("🔄 Tentando conectar ao MySQL com senha...");
      if (envPassword !== undefined) {
        connectionConfig.password = envPassword;
      }
      this.pool = mysql.createPool(connectionConfig);
      await this.pool.query("SELECT 1");
      console.log("✅ MySQL conectado (com senha)");
    } catch (error) {
      if (error.code === "ER_BAD_DB_ERROR") {
        // DB não existe ainda, cria e reconecta
        console.warn(
          `⚠️  Banco de dados '${connectionConfig.database}' não encontrado. Tentando criar...`
        );
        await this.createDatabase(connectionConfig);
      } else if (error.code === "ER_ACCESS_DENIED_ERROR") {
        // 2) Se acesso negado, tenta sem senha
        console.warn(
          "⚠️  Acesso com senha negado. Tentando conectar sem senha..."
        );
        const noPassConfig = { ...connectionConfig, password: "" };
        try {
          this.pool = mysql.createPool(noPassConfig);
          await this.pool.query("SELECT 1");
          console.log("✅ MySQL conectado (sem senha)");
        } catch (noPasswordError) {
          if (noPasswordError.code === "ER_BAD_DB_ERROR") {
            console.warn(
              `⚠️  Banco de dados '${connectionConfig.database}' não encontrado (sem senha). Criando...`
            );
            await this.createDatabase(noPassConfig);
          } else {
            console.error(
              "❌ Falha na conexão com e sem senha.",
              noPasswordError
            );
            throw noPasswordError;
          }
        }
      } else {
        console.error(
          "❌ Erro inesperado na conexão com o banco de dados.",
          error
        );
        throw error;
      }
    }

    this.connection = this.pool; // --- Mantém a compatibilidade com o resto do código que usa this.connection ---
    await this.createTables(); // --- Cria as tabelas ---
  }

  async createDatabase(config) {
    // --- Cria um banco de dados ---
    let tempConnection; // --- Cria uma conexão temporária sem especificar o banco de dados ---
    try {
      const tempConfig = { ...config, database: null }; // --- Cria uma configuração temporária sem especificar o banco de dados ---
      tempConnection = await mysql.createConnection(tempConfig); // --- Cria uma conexão temporária sem especificar o banco de dados ---

      await tempConnection.query(
        `CREATE DATABASE IF NOT EXISTS \`${config.database}\`;`
      ); // --- Cria o banco de dados ---
      console.log(
        `✅ Banco de dados '${config.database}' criado ou já existente.`
      ); // --- Exibe uma mensagem de sucesso ---

      // --- Reconecta usando a configuração original com o banco de dados ---
      this.pool = mysql.createPool(config); // --- Cria um pool de conexões ---
      await this.pool.query("SELECT 1"); // --- Testa a conexão ---
      console.log(
        `✅ Conectado ao banco de dados '${config.database}' recém-criado.`
      ); // --- Exibe uma mensagem de sucesso ---
    } catch (error) {
      console.error(`❌ Falha crítica ao criar o banco de dados.`, error); // --- Exibe uma mensagem de erro ---
      throw error; // --- Lança outros erros ---
    } finally {
      if (tempConnection) {
        // --- Se a conexão temporária existe, fecha a conexão ---
        await tempConnection.end(); // --- Fecha a conexão ---
      }
    }
  }

  async createTables() {
    // --- Cria as tabelas ---
    if (!this.pool)
      throw new Error("A conexão com o banco de dados não foi estabelecida."); // --- Lança um erro se a conexão com o banco de dados não foi estabelecida ---
    try {
      // --- Tenta criar as tabelas ---
      // --- Cria a tabela de workflows ---
      await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS workflows (
                    id VARCHAR(255) PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    active BOOLEAN DEFAULT false,
                    nodes JSON,
                    connections JSON,
                    settings JSON,
                    staticData JSON,
                    tags JSON,
                    triggerCount INT DEFAULT 0,
                    owner_user_id INT NULL,
                    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

      // Garantir coluna owner_user_id em bancos existentes (migração leve)
      try {
        const [cols] = await this.pool.execute(
          `SELECT COUNT(*) AS cnt
           FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'workflows' AND COLUMN_NAME = 'owner_user_id'`
        );
        if (!cols[0] || cols[0].cnt === 0) {
          await this.pool.execute(`ALTER TABLE workflows ADD COLUMN owner_user_id INT NULL`);
          console.log("🛠️ Coluna owner_user_id adicionada à tabela workflows");
        }
      } catch (migErr) {
        console.warn("⚠️ Não foi possível verificar/adicionar coluna owner_user_id:", migErr.message);
      }
      // --- Cria a tabela de agents ---
      await this.connection.execute(`
                CREATE TABLE IF NOT EXISTS agents (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    workflow_id VARCHAR(255) NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    prompt TEXT,
                    active BOOLEAN DEFAULT true,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
                )
            `);
      await this.connection.execute(`
                CREATE TABLE IF NOT EXISTS credentials (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    workflow_id VARCHAR(255) NOT NULL,
                    type VARCHAR(255) NOT NULL,
                    data JSON NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
                    UNIQUE KEY (workflow_id, type)
                )
            `);

      // --- Cria a tabela de clients (multi-tenant) ---
      await this.connection.execute(`
                CREATE TABLE IF NOT EXISTS clients (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    client_id VARCHAR(255) UNIQUE NOT NULL,
                    client_name VARCHAR(255) NOT NULL,
                    client_email VARCHAR(255) NOT NULL,
                    port INT NOT NULL,
                    n8n_port INT NOT NULL,
                    status ENUM('active', 'inactive', 'stopped') DEFAULT 'active',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_client_id (client_id),
                    INDEX idx_port (port),
                    INDEX idx_n8n_port (n8n_port)
                )
            `);

      // --- Cria a tabela de configurações do N8N ---
      await this.connection.execute(`
                CREATE TABLE IF NOT EXISTS n8n_configs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT,
                    instance_url VARCHAR(500) NOT NULL,
                    api_key VARCHAR(500) NOT NULL,
                    is_active BOOLEAN DEFAULT TRUE,
                    last_tested TIMESTAMP NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    INDEX idx_user_id (user_id),
                    INDEX idx_active (is_active)
                )
            `);

      // --- Cria a tabela de logs de execução ---
      await this.connection.execute(`
                CREATE TABLE IF NOT EXISTS execution_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id VARCHAR(255) NOT NULL,
                    prompt TEXT NOT NULL,
                    workflow_id VARCHAR(255),
                    workflow_name VARCHAR(255),
                    status ENUM('success', 'error', 'paused') NOT NULL,
                    error_message TEXT,
                    detailed_logs JSON,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_user_id (user_id),
                    INDEX idx_status (status)
                )
            `);

      console.log(
        "✅ Tabelas 'workflows', 'agents', 'credentials', 'clients', 'n8n_configs' e 'execution_logs' verificadas/criadas com sucesso."
      );
    } catch (error) {
      console.error("❌ Erro ao criar as tabelas:", error);
      throw error;
    }
  }

  async syncAllWorkflows(n8nWorkflows) {
    // --- Sincroniza todos os workflows ---
    if (!n8nWorkflows || n8nWorkflows.length === 0) {
      // --- Se não houver workflows, retorna ---
      console.log("Nenhum workflow para sincronizar."); // --- Exibe uma mensagem ---
      return; // --- Retorna ---
    }

    // --- Cria a query para sincronizar os workflows ---
    const query = `
            INSERT INTO workflows (id, name, active, nodes, connections, settings, staticData, tags, triggerCount, owner_user_id, createdAt, updatedAt)
            VALUES ?
            ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            active = VALUES(active),
            nodes = VALUES(nodes),
            connections = VALUES(connections),
            settings = VALUES(settings),
            staticData = VALUES(staticData),
            tags = VALUES(tags),
            triggerCount = VALUES(triggerCount),
            owner_user_id = VALUES(owner_user_id),
            updatedAt = VALUES(updatedAt)
        `;
    // --- Cria os valores para a query ---
    const values = n8nWorkflows.map((wf) => [
      wf.id,
      wf.name ?? "Workflow sem nome",
      wf.active ?? false,
      JSON.stringify(wf.nodes ?? null),
      JSON.stringify(wf.connections ?? null),
      JSON.stringify(wf.settings ?? null),
      JSON.stringify(wf.staticData ?? null),
      JSON.stringify(wf.tags ?? null),
      wf.triggerCount ?? 0,
      // meta.ownerUserId, se existir no workflow vindo do n8n
      (wf.meta && (wf.meta.ownerUserId || wf.meta.owner_user_id)) || null,
      wf.createdAt ? new Date(wf.createdAt) : new Date(),
      wf.updatedAt ? new Date(wf.updatedAt) : new Date(),
    ]);

    const connection = await this.pool.getConnection(); // --- Obtém uma conexão do pool ---
    try {
      // --- Tenta sincronizar os workflows ---
      await connection.beginTransaction(); // --- Inicia uma transação ---

      const workflowIds = n8nWorkflows.map((wf) => wf.id); // --- Obtém os IDs dos workflows ---
      if (workflowIds.length > 0) {
        // --- Se houver workflows, deleta os agentes ---
        await connection.query("DELETE FROM agents WHERE workflow_id IN (?)", [
          workflowIds,
        ]); // --- Deleta os agentes ---
      }

      if (values.length > 0) {
        // --- Se houver workflows, sincroniza os workflows ---
        await connection.query(query, [values]); // --- Sincroniza os workflows ---
      }

      for (const wf of n8nWorkflows) {
        // --- Para cada workflow ---
        const agentNodes = (wf.nodes || []).filter(
          (node) =>
            node.type === "@n8n/n8n-nodes-langchain.agent" ||
            node.type === "n8n-nodes-langchain.agent"
        );
        // --- Se houver agentes, sincroniza os agentes ---
        if (agentNodes.length > 0) {
          // --- Se houver agentes, sincroniza os agentes ---
          const agentValues = agentNodes.map((agentNode) => {
            // --- Obtém os valores dos agentes ---
            const prompt =
              agentNode.parameters?.options?.systemMessage ||
              agentNode.parameters?.text ||
              ""; // --- Obtém o prompt do agente ---
            return [
              wf.id, // --- ID do workflow ---
              agentNode.name || "Agente sem nome", // --- Nome do agente ---
              prompt, // --- Prompt do agente ---
            ];
          });
          await connection.query(
            "INSERT INTO agents (workflow_id, name, prompt) VALUES ?",
            [agentValues]
          ); // --- Sincroniza os agentes ---
        }
      }

      await connection.commit(); // --- Comita a transação ---
      console.log(
        `✅ ${values.length} workflows e seus agentes foram sincronizados com o banco de dados.`
      ); // --- Exibe uma mensagem de sucesso ---
    } catch (error) {
      // --- Se houver um erro, desfaz a transação ---
      await connection.rollback(); // --- Desfaz a transação ---
      console.error("❌ Erro na transação de sincronização:", error); // --- Exibe uma mensagem de erro ---
      throw error; // --- Lança outros erros ---
    } finally {
      // --- Finaliza a transação ---
      connection.release(); // --- Libera a conexão ---
    }
  }

  async getWorkflows(userId = null) {
    // Lista workflows; se userId for informado, filtra estritamente por proprietário
    if (userId) {
      const [rows] = await this.pool.execute(
        `SELECT w.*, COUNT(a.id) as agent_count
         FROM workflows w
         LEFT JOIN agents a ON w.id = a.workflow_id
         WHERE w.owner_user_id = ?
         GROUP BY w.id`,
        [userId]
      );
      return rows;
    }
    const [rows] = await this.pool.execute(`
           SELECT w.*, COUNT(a.id) as agent_count
           FROM workflows w LEFT JOIN agents a ON w.id = a.workflow_id
           GROUP BY w.id
       `);
    return rows;
  }

  async getWorkflowWithAgents(workflowId) {
    // --- Obtém um workflow com seus agentes ---
    const [workflows] = await this.pool.execute(
      "SELECT * FROM workflows WHERE id = ?",
      [workflowId]
    ); // --- Obtém o workflow ---
    if (workflows.length === 0) return null; // --- Se não houver workflow, retorna null ---
    const workflow = workflows[0]; // --- Obtém o workflow ---
    const [agents] = await this.pool.execute(
      "SELECT * FROM agents WHERE workflow_id = ?",
      [workflowId]
    ); // --- Obtém os agentes ---
    workflow.agents = agents;
    return workflow;
  }

  async toggleWorkflowStatus(workflowId) {
    // --- Alterna o status de um workflow ---
    const [workflows] = await this.pool.execute(
      "SELECT active FROM workflows WHERE id = ?",
      [workflowId]
    ); // --- Obtém o workflow ---
    if (workflows.length === 0) throw new Error("Workflow not found"); // --- Se não houver workflow, lança um erro ---
    const newStatus = !workflows[0].active; // --- Obtém o novo status ---
    await this.pool.execute("UPDATE workflows SET active = ? WHERE id = ?", [
      newStatus,
      workflowId,
    ]); // --- Atualiza o status do workflow ---
    return { success: true, active: newStatus }; // --- Retorna o novo status ---
  }

  async updateWorkflowName(workflowId, newName) {
    // --- Atualiza o nome de um workflow ---
    await this.pool.execute("UPDATE workflows SET name = ? WHERE id = ?", [
      newName,
      workflowId,
    ]); // --- Atualiza o nome do workflow ---
    return { success: true }; // --- Retorna o novo nome ---
  }

  async updateAgentName(agentId, newName) {
    // --- Atualiza o nome de um agente ---
    await this.pool.execute("UPDATE agents SET name = ? WHERE id = ?", [
      newName,
      agentId,
    ]); // --- Atualiza o nome do agente ---
    return { success: true }; // --- Retorna o novo nome ---
  }

  async updateAgentPrompt(agentId, newPrompt) {
    // --- Atualiza o prompt de um agente ---
    await this.pool.execute("UPDATE agents SET prompt = ? WHERE id = ?", [
      newPrompt,
      agentId,
    ]); // --- Atualiza o prompt do agente ---
    return { success: true }; // --- Retorna o novo prompt ---
  }

  async deleteWorkflowAndAgents(workflowId) {
    // --- Deleta um workflow e seus agentes ---
    const [result] = await this.pool.execute(
      "DELETE FROM workflows WHERE id = ?",
      [workflowId]
    ); // --- Deleta o workflow ---
    if (result.affectedRows === 0) {
      // --- Se não houver workflow, exibe uma mensagem de erro ---
      console.warn(
        `Workflow com ID ${workflowId} não encontrado no banco para deletar.`
      ); // --- Exibe uma mensagem de erro ---
    }
    return { success: true }; // --- Retorna true ---
  }

  async saveCredentials(workflowId, credentials) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      for (const type in credentials) {
        const data = JSON.stringify(credentials[type]);
        await connection.query(
          `
                    INSERT INTO credentials (workflow_id, type, data)
                    VALUES (?, ?, ?)
                    ON DUPLICATE KEY UPDATE data = VALUES(data)
                `,
          [workflowId, type, data]
        );
      }
      await connection.commit();
      return { success: true };
    } catch (error) {
      await connection.rollback();
      console.error("Erro ao salvar credenciais:", error);
      throw error;
    } finally {
      connection.release();
    }
  }

  async getCredentials(workflowId) {
    const [rows] = await this.pool.execute(
      "SELECT type, data FROM credentials WHERE workflow_id = ?",
      [workflowId]
    );
    const credentials = {};
    for (const row of rows) {
      try {
        // O 'data' vem do DB como uma string JSON, precisamos fazer o parse.
        if (typeof row.data === "string") {
          credentials[row.type] = JSON.parse(row.data);
        } else if (typeof row.data === "object") {
          // Se já é um objeto, usa diretamente
          credentials[row.type] = row.data;
        } else {
          console.warn(
            `⚠️ Tipo de dados inesperado para credential ${row.type}:`,
            typeof row.data,
            row.data
          );
          credentials[row.type] = {};
        }
      } catch (error) {
        console.error(
          `❌ Erro ao fazer parse das credenciais ${row.type}:`,
          error.message
        );
        console.error(`Dados problemáticos:`, row.data);
        credentials[row.type] = {};
      }
    }
    return credentials;
  }

  // Métodos para gerenciar configurações do N8N
  async saveN8nConfig(userId, instanceUrl, apiKey) {
    try {
      // Desativar configurações antigas do usuário
      await this.connection.execute(
        "UPDATE n8n_configs SET is_active = FALSE WHERE user_id = ?",
        [userId]
      );

      // Inserir nova configuração
      const [result] = await this.connection.execute(
        `INSERT INTO n8n_configs (user_id, instance_url, api_key, last_tested) 
         VALUES (?, ?, ?, NOW())`,
        [userId, instanceUrl, apiKey]
      );

      return { success: true, configId: result.insertId };
    } catch (error) {
      console.error("❌ Erro ao salvar configuração N8N:", error);
      throw error;
    }
  }

  async getN8nConfig(userId) {
    try {
      const [rows] = await this.connection.execute(
        `SELECT * FROM n8n_configs 
         WHERE user_id = ? AND is_active = TRUE 
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );

      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error("❌ Erro ao buscar configuração N8N:", error);
      throw error;
    }
  }

  async deleteN8nConfig(userId) {
    try {
      await this.connection.execute(
        "UPDATE n8n_configs SET is_active = FALSE WHERE user_id = ?",
        [userId]
      );
      return { success: true };
    } catch (error) {
      console.error("❌ Erro ao deletar configuração N8N:", error);
      throw error;
    }
  }

  async updateN8nConfigLastTested(userId) {
    try {
      await this.connection.execute(
        "UPDATE n8n_configs SET last_tested = NOW() WHERE user_id = ? AND is_active = TRUE",
        [userId]
      );
      return { success: true };
    } catch (error) {
      console.error("❌ Erro ao atualizar último teste N8N:", error);
      throw error;
    }
  }
}
// --- Exporta a classe ---
module.exports = Database;
