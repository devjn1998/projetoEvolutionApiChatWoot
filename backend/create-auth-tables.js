const Database = require('./database');

async function createAuthTables() {
  const db = new Database();
  await db.init();
  
  try {
    // Tabela de usuários
    await db.connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        fullName VARCHAR(255) NOT NULL,
        nameEnterprise VARCHAR(255) NOT NULL,
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        instanceName VARCHAR(100) UNIQUE,
        chatwootAccountId INT,
        chatwootAccountName VARCHAR(255),
        chatwootAccountDomain VARCHAR(255),
        chatwootUserId INT,
        chatwootAccessToken VARCHAR(500),
        chatwootLastSync TIMESTAMP NULL,
        evolutionInstanceName VARCHAR(100),
        whatsappConnected BOOLEAN DEFAULT FALSE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        isActive BOOLEAN DEFAULT TRUE
      )
    `);
    
    // Tabela de sessões de login
    await db.connection.execute(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        sessionToken VARCHAR(500) NOT NULL,
        expiresAt TIMESTAMP NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_session_token (sessionToken),
        INDEX idx_expires_at (expiresAt)
      )
    `);
    
    // Tabela de instâncias (para rastrear WhatsApp + Chatwoot)
    await db.connection.execute(`
      CREATE TABLE IF NOT EXISTS instances (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        instanceName VARCHAR(100) UNIQUE NOT NULL,
        evolutionInstanceId VARCHAR(100),
        evolutionInstanceName VARCHAR(100),
        evolutionInstanceCreated BOOLEAN DEFAULT FALSE,
        evolutionInstanceCreatedAt TIMESTAMP NULL,
        chatwootAccountId INT,
        chatwootInboxId INT,
        whatsappConnected BOOLEAN DEFAULT FALSE,
        qrCodeGenerated BOOLEAN DEFAULT FALSE,
        qrCodeGeneratedAt TIMESTAMP NULL,
        lastQrCodeAt TIMESTAMP NULL,
        connectedAt TIMESTAMP NULL,
        lastStatusCheck TIMESTAMP NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        isActive BOOLEAN DEFAULT TRUE,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (userId),
        INDEX idx_instance_name (instanceName),
        INDEX idx_evolution_instance (evolutionInstanceId)
      )
    `);
    
    console.log('✅ Tabelas de autenticação criadas com sucesso!');
    
    // Adicionar colunas se não existirem (para compatibilidade com tabelas existentes)
    try {
      await db.connection.execute(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS chatwootAccountName VARCHAR(255) AFTER chatwootAccountId,
        ADD COLUMN IF NOT EXISTS chatwootAccountDomain VARCHAR(255) AFTER chatwootAccountName,
        ADD COLUMN IF NOT EXISTS chatwootLastSync TIMESTAMP NULL AFTER chatwootAccessToken
      `);
      console.log('✅ Colunas adicionadas na tabela users');
    } catch (error) {
      console.log('ℹ️ Colunas já existem na tabela users ou erro ao adicionar:', error.message);
    }

    try {
      await db.connection.execute(`
        ALTER TABLE instances 
        ADD COLUMN IF NOT EXISTS evolutionInstanceId VARCHAR(100) AFTER instanceName,
        ADD COLUMN IF NOT EXISTS evolutionInstanceCreated BOOLEAN DEFAULT FALSE AFTER evolutionInstanceName,
        ADD COLUMN IF NOT EXISTS evolutionInstanceCreatedAt TIMESTAMP NULL AFTER evolutionInstanceCreated,
        ADD COLUMN IF NOT EXISTS qrCodeGeneratedAt TIMESTAMP NULL AFTER qrCodeGenerated,
        ADD COLUMN IF NOT EXISTS lastStatusCheck TIMESTAMP NULL AFTER connectedAt
      `);
      console.log('✅ Colunas adicionadas na tabela instances');
    } catch (error) {
      console.log('ℹ️ Colunas já existem na tabela instances ou erro ao adicionar:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Erro ao criar tabelas:', error);
  } finally {
    await db.connection.end();
  }
}

createAuthTables();
