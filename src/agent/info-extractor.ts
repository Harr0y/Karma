// Info Extractor - 从 Agent 输出中提取结构化信息

/**
 * Extraction mode configuration
 * - xml: Use XML tags + regex fallback (default, more reliable)
 * - json: Direct JSON output from AI (simpler, requires AI cooperation)
 */
export type ExtractionMode = 'xml' | 'json';

// Default extraction mode (can be overridden by config)
let currentMode: ExtractionMode = 'xml';

/**
 * Set the extraction mode
 */
export function setExtractionMode(mode: ExtractionMode): void {
  currentMode = mode;
}

/**
 * Get the current extraction mode
 */
export function getExtractionMode(): ExtractionMode {
  return currentMode;
}

export interface ExtractedClientInfo {
  name?: string;
  gender?: 'male' | 'female';
  birthDate?: string;
  birthPlace?: string;
  currentCity?: string;
}

export interface ExtractedFact {
  fact: string;
  category?: string;
}

export interface ExtractedPrediction {
  prediction: string;
  year?: number;
}

/**
 * 从 Agent 输出中提取客户信息
 *
 * 支持的标签格式：
 * <client_info>
 * 姓名：张三
 * 性别：男
 * 生辰：1990年5月15日早上6点
 * 出生地：北京
 * 现居：上海
 * </client_info>
 */
export function extractClientInfo(text: string): ExtractedClientInfo | null {
  // 匹配 <client_info> 标签
  const match = text.match(/<client_info>([\s\S]*?)<\/client_info>/);
  if (!match) return null;

  const content = match[1].trim();
  if (!content) return null;

  const info: ExtractedClientInfo = {};

  // 提取姓名（支持中英文冒号）
  const nameMatch = content.match(/姓名[：:]\s*(.+?)(?:\n|$)/);
  if (nameMatch) {
    info.name = nameMatch[1].trim();
  }

  // 提取性别
  const genderMatch = content.match(/性别[：:]\s*(男|女)/);
  if (genderMatch) {
    info.gender = genderMatch[1] === '男' ? 'male' : 'female';
  }

  // 提取生辰
  const birthMatch = content.match(/生辰[：:]\s*(.+?)(?:\n|$)/);
  if (birthMatch) {
    info.birthDate = birthMatch[1].trim();
  }

  // 提取出生地
  const placeMatch = content.match(/出生地[：:]\s*(.+?)(?:\n|$)/);
  if (placeMatch) {
    info.birthPlace = placeMatch[1].trim();
  }

  // 提取现居地
  const cityMatch = content.match(/现居[：:]\s*(.+?)(?:\n|$)/);
  if (cityMatch) {
    info.currentCity = cityMatch[1].trim();
  }

  // 如果没有提取到任何信息，返回 null
  if (Object.keys(info).length === 0) return null;

  return info;
}

/**
 * 从 Agent 输出中提取确认的事实
 *
 * 支持的标签格式：
 * <confirmed_fact category="career">目前在互联网公司工作</confirmed_fact>
 * <confirmed_fact>已婚，有一个孩子</confirmed_fact>
 */
export function extractFact(text: string): ExtractedFact | null {
  // 匹配带或不带 category 的 confirmed_fact 标签
  const match = text.match(
    /<confirmed_fact(?:\s+category="([^"]*)")?>([^<]*)<\/confirmed_fact>/
  );
  if (!match) return null;

  const fact = match[2].trim();
  if (!fact) return null;

  return {
    category: match[1] || undefined,
    fact,
  };
}

/**
 * 从 Agent 输出中提取预测
 *
 * 支持的标签格式：
 * <prediction year="2025">下半年有晋升机会</prediction>
 * <prediction>未来三年财运会好转</prediction>
 */
export function extractPrediction(text: string): ExtractedPrediction | null {
  // 匹配带或不带 year 的 prediction 标签
  const match = text.match(/<prediction(?:\s+year="(\d+)")?>([^<]*)<\/prediction>/);
  if (!match) return null;

  const prediction = match[2].trim();
  if (!prediction) return null;

  return {
    year: match[1] ? parseInt(match[1], 10) : undefined,
    prediction,
  };
}

/**
 * 从文本中提取所有确认的事实
 */
export function extractAllFacts(text: string): ExtractedFact[] {
  const facts: ExtractedFact[] = [];
  const regex = /<confirmed_fact(?:\s+category="([^"]*)")?>([^<]*)<\/confirmed_fact>/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const fact = match[2].trim();
    if (fact) {
      facts.push({
        category: match[1] || undefined,
        fact,
      });
    }
  }

  return facts;
}

/**
 * 从文本中提取所有预测
 */
export function extractAllPredictions(text: string): ExtractedPrediction[] {
  const predictions: ExtractedPrediction[] = [];
  const regex = /<prediction(?:\s+year="(\d+)")?>([^<]*)<\/prediction>/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const prediction = match[2].trim();
    if (prediction) {
      predictions.push({
        year: match[1] ? parseInt(match[1], 10) : undefined,
        prediction,
      });
    }
  }

  return predictions;
}

/**
 * Fallback: 从原始文本中提取客户信息（当 AI 不输出标签时）
 *
 * 尝试从文本中识别常见的客户信息模式
 */
export function extractClientInfoFallback(text: string): ExtractedClientInfo | null {
  const info: ExtractedClientInfo = {};

  // 提取性别
  if (text.includes('男') && !text.includes('难')) {
    info.gender = 'male';
  } else if (text.includes('女')) {
    info.gender = 'female';
  }

  // 提取出生日期 - 多种格式
  // 格式1: 1990年5月15日
  const dateMatch1 = text.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]/);
  if (dateMatch1) {
    info.birthDate = `${dateMatch1[1]}年${dateMatch1[2]}月${dateMatch1[3]}日`;
  }

  // 格式2: 1990-05-15
  if (!info.birthDate) {
    const dateMatch2 = text.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (dateMatch2) {
      info.birthDate = `${dateMatch2[1]}年${parseInt(dateMatch2[2], 10)}月${parseInt(dateMatch2[3], 10)}日`;
    }
  }

  // 提取出生地 - 常见模式
  const placePatterns = [
    /出生(?:在|于|地[：:]?)\s*([^\s，。！？,\n]+)/,
    /([^\s，。！？,\n]+)(?:人|出生)/,
  ];
  for (const pattern of placePatterns) {
    const match = text.match(pattern);
    if (match && match[1].length >= 2 && match[1].length <= 10) {
      // 过滤掉一些常见干扰词
      const excludeWords = ['男', '女', '单身', '已婚', '未婚', '离婚'];
      if (!excludeWords.includes(match[1])) {
        info.birthPlace = match[1];
        break;
      }
    }
  }

  // 提取现居地
  const cityPatterns = [
    /现(?:在|居|住)[：:]?\s*([^\s，。！？,\n]+)/,
    /在\s*([^\s，。！？,\n]+)\s*(?:工作|发展|生活)/,
  ];
  for (const pattern of cityPatterns) {
    const match = text.match(pattern);
    if (match && match[1].length >= 2 && match[1].length <= 10) {
      const excludeWords = ['男', '女', '单身', '已婚', '未婚', '离婚', '做', '是', '有'];
      if (!excludeWords.includes(match[1])) {
        info.currentCity = match[1];
        break;
      }
    }
  }

  // 如果没有提取到任何信息，返回 null
  if (Object.keys(info).length === 0) return null;

  return info;
}

/**
 * JSON Mode: 从 AI 输出的 JSON 格式中提取客户信息
 *
 * 期望格式：
 * ```json
 * {
 *   "client_info": {
 *     "name": "张三",
 *     "gender": "male",
 *     "birthDate": "1990-05-15T06:00:00",
 *     "birthPlace": "北京",
 *     "currentCity": "上海"
 *   }
 * }
 * ```
 */
export function extractClientInfoFromJson(text: string): ExtractedClientInfo | null {
  // 尝试匹配 JSON 块
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
  if (!jsonMatch) {
    // 尝试直接解析整个文本作为 JSON
    try {
      const parsed = JSON.parse(text);
      if (parsed.client_info) {
        return {
          name: parsed.client_info.name,
          gender: parsed.client_info.gender,
          birthDate: parsed.client_info.birthDate,
          birthPlace: parsed.client_info.birthPlace,
          currentCity: parsed.client_info.currentCity,
        };
      }
    } catch {
      return null;
    }
    return null;
  }

  try {
    const parsed = JSON.parse(jsonMatch[1].trim());
    if (parsed.client_info) {
      return {
        name: parsed.client_info.name,
        gender: parsed.client_info.gender,
        birthDate: parsed.client_info.birthDate,
        birthPlace: parsed.client_info.birthPlace,
        currentCity: parsed.client_info.currentCity,
      };
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * 统一提取函数 - 根据当前模式选择提取方法
 *
 * @param text AI 输出文本
 * @param mode 可选，覆盖当前模式
 */
export function extractClientInfoUnified(
  text: string,
  mode?: ExtractionMode
): ExtractedClientInfo | null {
  const useMode = mode || currentMode;

  if (useMode === 'json') {
    // JSON 模式：先尝试 JSON，失败则 fallback
    const jsonResult = extractClientInfoFromJson(text);
    if (jsonResult) return jsonResult;
  }

  // XML 模式或 JSON 失败时：先尝试 XML，失败则 fallback
  const xmlResult = extractClientInfo(text);
  if (xmlResult) return xmlResult;

  // 最后尝试 fallback
  return extractClientInfoFallback(text);
}
