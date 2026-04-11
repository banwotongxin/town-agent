/**
 * Jest 测试配置
 * 
 * 用于支持 TypeScript 测试文件
 */

module.exports = {
  // 预设：使用 ts-jest
  preset: 'ts-jest',
  
  // 测试环境
  testEnvironment: 'node',
  
  // 测试文件匹配模式
  testMatch: [
    '**/*.test.ts',
    '**/*.spec.ts'
  ],
  
  // 忽略的文件/目录
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/'
  ],
  
  // 覆盖率报告配置
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts'
  ],
  
  // 覆盖率阈值
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 85,
      lines: 80,
      statements: 80
    }
  },
  
  // 模块映射
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  
  // 转换配置
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        // TypeScript 配置
        tsconfig: {
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          module: 'commonjs',
          target: 'ES2020'
        }
      }
    ]
  },
  
  // 详细输出
  verbose: true,
  
  // 测试超时时间（毫秒）
  testTimeout: 10000,
  
  // 全局变量
  globals: {}
};
