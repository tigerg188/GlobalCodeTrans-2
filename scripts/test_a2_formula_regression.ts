import { parseLatexToDocxMathChildren } from '../utils/docxExport';

interface TestCase {
  id: string;
  name: string;
  latex: string;
  verify: (res: any[], rawJson: string) => { pass: boolean; reason?: string };
}

const testCases: TestCase[] = [
  {
    id: 'A',
    name: '分式与下标: S_a = \\frac{S_{D1}}{T}',
    latex: String.raw`S_a = \frac{S_{D1}}{T}`,
    verify: (res, json) => {
      const hasSub = json.includes('"rootKey": "m:sSub"');
      const hasFrac = json.includes('"rootKey": "m:f"');
      const hasNoBrace = !json.includes('"}') && !json.includes('"{');
      return {
        pass: hasSub && hasFrac && hasNoBrace,
        reason: `hasSub=${hasSub}, hasFrac=${hasFrac}, hasNoBrace=${hasNoBrace}`
      };
    }
  },
  {
    id: 'B',
    name: '普通平方根: \\sqrt{a+b}',
    latex: String.raw`\sqrt{a+b}`,
    verify: (res, json) => {
      const hasRad = json.includes('"rootKey": "m:rad"');
      const hasContent = json.includes('"a+b"');
      return {
        pass: hasRad && hasContent,
        reason: `hasRad=${hasRad}, hasContent=${hasContent}`
      };
    }
  },
  {
    id: 'C',
    name: '带次数的根式: \\sqrt[3]{x}',
    latex: String.raw`\sqrt[3]{x}`,
    verify: (res, json) => {
      const hasRad = json.includes('"rootKey": "m:rad"');
      const hasDegree = json.includes('"rootKey": "m:deg"');
      const hasDeg3 = json.includes('"3"');
      const hasContentX = json.includes('"x"');
      const notPlainTextSqrt = !json.includes('"sqrt"');
      return {
        pass: hasRad && hasDegree && hasDeg3 && hasContentX && notPlainTextSqrt,
        reason: `hasRad=${hasRad}, hasDegree=${hasDegree}, hasDeg3=${hasDeg3}, notPlainTextSqrt=${notPlainTextSqrt}`
      };
    }
  },
  {
    id: 'D',
    name: '复合中括号与嵌套上下标: [K_z]_{max}^2',
    latex: String.raw`[K_z]_{max}^2`,
    verify: (res, json) => {
      const hasSubSup = json.includes('"rootKey": "m:sSubSup"');
      const hasBracket = json.includes('"rootKey": "m:d"');
      const hasMax = json.includes('"max"');
      const has2 = json.includes('"2"');
      const noStrayHat = !json.includes('"^2"');
      return {
        pass: hasSubSup && hasBracket && hasMax && has2 && noStrayHat,
        reason: `hasSubSup=${hasSubSup}, hasBracket=${hasBracket}, hasMax=${hasMax}, noStrayHat=${noStrayHat}`
      };
    }
  },
  {
    id: 'E',
    name: '求和符号带上下限与指数: \\sum_{i=1}^{n} w_i h_i^k',
    latex: String.raw`\sum_{i=1}^{n} w_i h_i^k`,
    verify: (res, json) => {
      const hasSubSup = json.includes('"rootKey": "m:sSubSup"');
      const hasSum = json.includes('"∑"');
      const hasLimitI = json.includes('"i=1"');
      const hasLimitN = json.includes('"n"');
      const noResidualBrace = !json.includes('"n}"') && !json.includes('"}');
      const hasSupK = json.includes('"k"'); // Verifies h_i^k preserves ^k
      return {
        pass: hasSubSup && hasSum && hasLimitI && hasLimitN && noResidualBrace && hasSupK,
        reason: `hasSubSup=${hasSubSup}, hasSum=${hasSum}, noResidualBrace=${noResidualBrace}, hasSupK=${hasSupK}`
      };
    }
  },
  {
    id: 'F',
    name: '定积分与上下限: \\int_{0}^{T} S_a(t)\\,dt',
    latex: String.raw`\int_{0}^{T} S_a(t)\,dt`,
    verify: (res, json) => {
      const hasSubSup = json.includes('"rootKey": "m:sSubSup"');
      const hasInt = json.includes('"∫"');
      const has0 = json.includes('"0"');
      const hasT = json.includes('"T"');
      const noResidualBrace = !json.includes('"T}"') && !json.includes('"}');
      return {
        pass: hasSubSup && hasInt && has0 && hasT && noResidualBrace,
        reason: `hasSubSup=${hasSubSup}, hasInt=${hasInt}, noResidualBrace=${noResidualBrace}`
      };
    }
  }
];

let failedCount = 0;

console.log('================================================================');
console.log('       A2 公式解析器确定性缺陷修复回归验证 (Formula Regression)      ');
console.log('================================================================\n');

for (const t of testCases) {
  console.log(`--- [用例 ${t.id}] ${t.name} ---`);
  console.log(`原始 LaTeX 输入: ${t.latex}`);
  try {
    const res = parseLatexToDocxMathChildren(t.latex);
    const types = res.map(r => r.constructor?.name || typeof r);
    const json = JSON.stringify(res, null, 2);
    const check = t.verify(res, json);

    console.log(`生成 OMML 结构: [${types.join(', ')}]`);
    if (check.pass) {
      console.log(`✅ [PASS] 断言成功!`);
    } else {
      console.error(`❌ [FAIL] 断言未通过: ${check.reason}`);
      console.error(`实际输出 JSON: \n${json.slice(0, 400)}...`);
      failedCount++;
    }
  } catch (err: any) {
    console.error(`❌ [ERROR] 解析抛出异常: ${err.message}`);
    failedCount++;
  }
  console.log('');
}

console.log('================================================================');
if (failedCount === 0) {
  console.log('🎉 全部 6 组核心工程公式回归测试 100% 成功通过！');
  console.log('   - 根式开方次数 [3] 完整生成 <m:deg>');
  console.log('   - 复合中括号 [K_z]_{max}^2 上下标无缝绑定生成 <m:sSubSup>');
  console.log('   - 求和与积分上标残留 "n}"、"T}" 彻底消除');
  console.log('   - 乘幂 h_i^k 之 ^k 丢失缺陷彻底修复');
  console.log('================================================================');
  process.exit(0);
} else {
  console.error(`💥 存在 ${failedCount} 处失败，请排查！`);
  process.exit(1);
}
