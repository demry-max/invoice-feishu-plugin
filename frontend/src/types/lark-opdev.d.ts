/**
 * Type declarations for @lark-opdev/block-bitable-api
 *
 * This package is only available at runtime inside the feishu-block
 * Bitable extension environment (webpack build). These minimal type
 * stubs let the frontend compile cleanly under Vite / tsc.
 */
declare module "@lark-opdev/block-bitable-api" {
  interface Selection {
    tableId?: string;
    viewId?: string;
    fieldId?: string;
    recordId?: string;
  }

  interface IFieldMeta {
    id: string;
    name: string;
    type: number;
  }

  interface IRecordValues {
    fields: Record<string, unknown>;
  }

  interface IWidgetTable {
    getFieldMetaList(): Promise<IFieldMeta[]>;
    getRecordIdList(): Promise<(string | undefined)[]>;
    getRecordById(recordId: string): Promise<IRecordValues>;
    setRecord(
      recordId: string,
      recordValues: { fields: Record<string, unknown> },
    ): Promise<string>;
  }

  interface IWidgetBase {
    getSelection(): Promise<Selection>;
    getTableById(tableId: string): Promise<IWidgetTable>;
    onSelectionChange(
      callback: (e: { data: Selection }) => void,
    ): () => void;
  }

  export const bitable: {
    base: IWidgetBase;
  };
}
