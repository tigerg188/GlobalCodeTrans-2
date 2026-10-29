declare module 'mammoth' {
  export interface MammothResult {
    value: string;
    messages: any[];
  }

  export function convertToHtml(input: { arrayBuffer?: ArrayBuffer; buffer?: Buffer; path?: string }): Promise<MammothResult>;
  export function convertToMarkdown(input: { arrayBuffer?: ArrayBuffer; buffer?: Buffer; path?: string }): Promise<MammothResult>;
  export function extractRawText(input: { arrayBuffer?: ArrayBuffer; buffer?: Buffer; path?: string }): Promise<MammothResult>;

  const mammoth: {
    convertToHtml: typeof convertToHtml;
    convertToMarkdown: typeof convertToMarkdown;
    extractRawText: typeof extractRawText;
  };

  export default mammoth;
}
