/**
 * 前端飞书适配器
 *
 * 封装飞书 Bitable Extension SDK 调用。
 * 开发阶段使用 mock，后续替换为真实 SDK。
 */

import type { SourceItem } from '../types';
import { getMockSourceItems } from '../services/api';

export interface FrontendFeishuAdapter {
  getSelectedRecords(): Promise<SourceItem[]>;
}

/** Mock 适配器 - 从后端 API 获取 mock 数据 */
class MockFrontendAdapter implements FrontendFeishuAdapter {
  async getSelectedRecords(): Promise<SourceItem[]> {
    return getMockSourceItems();
  }
}

/**
 * 真实飞书适配器（骨架）
 * 接入飞书 Bitable Extension SDK 后实现:
 *
 * import { bitable } from '@lark-base-open/js-sdk';
 */
class RealFrontendAdapter implements FrontendFeishuAdapter {
  async getSelectedRecords(): Promise<SourceItem[]> {
    // TODO: 实现真实 SDK 调用
    // const selection = await bitable.base.getSelection();
    // const table = await bitable.base.getActiveTable();
    // const records = ...
    throw new Error('Real Feishu adapter not implemented');
  }
}

export function createFrontendAdapter(): FrontendFeishuAdapter {
  const mode = import.meta.env.VITE_FEISHU_MODE;
  if (mode === 'real') {
    return new RealFrontendAdapter();
  }
  return new MockFrontendAdapter();
}
