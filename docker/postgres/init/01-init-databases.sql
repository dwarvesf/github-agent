-- Create a single database for both applications
CREATE DATABASE github_agent;

-- Connect to the single database
\c github_agent

-- Create application-specific roles with appropriate permissions
CREATE USER agent_user WITH PASSWORD 'agent_password';
CREATE USER discord_bot_user WITH PASSWORD 'discord_bot_password';

-- Create schemas for each application
CREATE SCHEMA IF NOT EXISTS agent_schema;
CREATE SCHEMA IF NOT EXISTS discord_bot_schema;

-- Set ownership of schemas to respective users
ALTER SCHEMA agent_schema OWNER TO agent_user;
ALTER SCHEMA discord_bot_schema OWNER TO discord_bot_user;

-- Grant privileges to application users
GRANT CONNECT ON DATABASE github_agent TO agent_user;
GRANT CONNECT ON DATABASE github_agent TO discord_bot_user;

-- Grant usage on schemas
GRANT USAGE ON SCHEMA agent_schema TO agent_user;
GRANT USAGE ON SCHEMA discord_bot_schema TO discord_bot_user;

-- Grant all privileges on all tables in schemas to respective users
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA agent_schema TO agent_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA discord_bot_schema TO discord_bot_user;

-- Grant privileges on future tables in schemas
ALTER DEFAULT PRIVILEGES IN SCHEMA agent_schema GRANT ALL PRIVILEGES ON TABLES TO agent_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA discord_bot_schema GRANT ALL PRIVILEGES ON TABLES TO discord_bot_user; 
