declare module 'playwright-core' {
  export const chromium: {
    launch(options?: any): Promise<any>;
  };
}
