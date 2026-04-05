import * as fs from 'fs';
import * as path from 'path';

export class SecurityConfig {
  private config: any;

  constructor() {
    this.loadConfig();
  }

  loadConfig() {
    try {
      const configPath = path.join(__dirname, '../../config/security_rules.yaml');
      if (fs.existsSync(configPath)) {
        const yaml = require('yaml');
        const configContent = fs.readFileSync(configPath, 'utf8');
        this.config = yaml.parse(configContent);
      } else {
        this.config = this.getDefaultConfig();
      }
    } catch (error) {
      console.error('加载安全配置失败:', error);
      this.config = this.getDefaultConfig();
    }
  }

  getInputBlacklist(): string[] {
    return this.config.input_blacklist || [];
  }

  getOutputBlacklist(): string[] {
    return this.config.output_blacklist || [];
  }

  getToolPermissions(): Record<string, { enabled: boolean; level: string }> {
    return this.config.tool_permissions || {};
  }

  getWriteTools(): string[] {
    return this.config.write_tools || [];
  }

  private getDefaultConfig() {
    return {
      input_blacklist: [
        'rm\s+-rf',
        'sudo',
        'chmod\s+777',
        'eval\(',
        'exec\(',
        'system\(',
        '\/etc\/passwd',
        '\/etc\/shadow',
        'API_KEY',
        'SECRET_KEY',
        'password',
        'token'
      ],
      output_blacklist: [
        'API_KEY',
        'SECRET_KEY',
        'password',
        'token',
        'private_key',
        'secret'
      ],
      tool_permissions: {
        read_file: { enabled: true, level: 'read-only' },
        write_file: { enabled: true, level: 'read-write' },
        ls: { enabled: true, level: 'read-only' },
        bash: { enabled: false, level: 'execute' },
        run_command: { enabled: false, level: 'execute' }
      },
      write_tools: [
        'write_file',
        'append_file',
        'delete_file',
        'mkdir',
        'rmdir'
      ]
    };
  }
}
