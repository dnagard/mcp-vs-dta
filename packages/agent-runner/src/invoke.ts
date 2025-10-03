// src/invoke.ts
export interface ToolInvoker {
  invoke(name: string, args: any): Promise<any>;
}
