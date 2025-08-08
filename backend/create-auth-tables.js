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
        chatwootUserId INT,
        chatwootAccessToken VARCHAR(500),
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
        evolutionInstanceName VARCHAR(100),
        chatwootAccountId INT,
        chatwootInboxId INT,
        whatsappConnected BOOLEAN DEFAULT FALSE,
        qrCodeGenerated BOOLEAN DEFAULT FALSE,
        lastQrCodeAt TIMESTAMP NULL,
        connectedAt TIMESTAMP NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        isActive BOOLEAN DEFAULT TRUE,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (userId),
        INDEX idx_instance_name (instanceName)
      )
    `);
    
    console.log('✅ Tabelas de autenticação criadas com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao criar tabelas:', error);
  } finally {
    await db.connection.end();
  }
}

createAuthTables();
