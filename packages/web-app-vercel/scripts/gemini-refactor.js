const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const { Project } = require("ts-morph");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const ts = require("typescript");

function getChangedFiles() {
  const gitArgs = ['log', '--since=1 week ago', '--name-only', '--pretty=format:', '--', '.'];

  const result = spawnSync('git', gitArgs, { encoding: "utf-8" });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const stderr = result.stderr?.trim() || result.stdout?.trim() || `git exited with code ${result.status}`;
    throw new Error(`Failed to execute git command: ${stderr}`);
  }

  const output = result.stdout;

  // JSでシェルコマンド (grep, sort, uniq) をシミュレート
  const allLines = output.split('\n').filter(line => line.trim());

  // grep -E '\.tsx?$' | grep -v -E '\.(test|spec)\.tsx?$'
  const fileOccurrences = {};

  for (const line of allLines) {
    const filePath = line.trim();
    if (filePath.match(/\.tsx?$/) && !filePath.match(/\.(test|spec)\.tsx?$/)) {
      fileOccurrences[filePath] = (fileOccurrences[filePath] || 0) + 1;
    }
  }

  // sort | uniq -c | sort -rn に相当する処理
  const files = Object.entries(fileOccurrences)
    .map(([path, count]) => {
      let filePath = path;
      // working-directoryがpackages/web-app-vercelなので、プレフィックスを削除
      if (filePath.startsWith("packages/web-app-vercel/")) {
        filePath = filePath.replace("packages/web-app-vercel/", "");
      }
      return { count, path: filePath };
    })
    .sort((a, b) => b.count - a.count);

  return files;
}

function analyzeComplexity(files) {
  const project = new Project({
    tsConfigFilePath: path.resolve(process.cwd(), "tsconfig.json"),
  });

  const analyzed = files
    .map((file) => {
      try {
        const sourceFile =
          project.getSourceFile(file.path) ||
          project.addSourceFileAtPath(file.path);

        const complexity = calculateCyclomaticComplexity(sourceFile);
        const lines = sourceFile.getFullText().split("\n").length;

        return {
          ...file,
          complexity,
          lines,
          score: complexity * 0.7 + file.count * 0.3, // 複雑度70%，変更頻度30%
        };
      } catch (error) {
        console.error(`Failed to analyze ${file.path}:`, error.message);
        return null;
      }
    })
    .filter((f) => f !== null);

  return analyzed.sort((a, b) => b.score - a.score);
}

function calculateCyclomaticComplexity(sourceFile) {
  let complexity = 1; // 基本複雑度

  sourceFile.forEachDescendant((node) => {
    const kind = node.getKind();

    // 分岐を増やす構文をカウント
    if (
      kind === ts.SyntaxKind.IfStatement ||
      kind === ts.SyntaxKind.ConditionalExpression ||
      kind === ts.SyntaxKind.CaseClause ||
      kind === ts.SyntaxKind.ForStatement ||
      kind === ts.SyntaxKind.ForInStatement ||
      kind === ts.SyntaxKind.ForOfStatement ||
      kind === ts.SyntaxKind.WhileStatement ||
      kind === ts.SyntaxKind.DoStatement ||
      kind === ts.SyntaxKind.CatchClause ||
      (kind === ts.SyntaxKind.BinaryExpression &&
        node.getOperatorToken &&
        typeof node.getOperatorToken === "function" &&
        (node.getOperatorToken().getKind() ===
          ts.SyntaxKind.AmpersandAmpersandToken ||
          node.getOperatorToken().getKind() === ts.SyntaxKind.BarBarToken))
    ) {
      complexity++;
    }
  });

  return complexity;
}

async function generateRefactoringSuggestions(files, maxFiles) {
  if (!process.env.GEMINI_API_KEY) {
    console.error("❌ GEMINI_API_KEY environment variable is required");
    process.exit(1);
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash", // 安定版に変更
  });

  const topFiles = files.slice(0, Math.min(maxFiles, files.length));

  if (topFiles.length === 0) {
    console.log("No files to analyze. Exiting.");
    process.exit(0);
  }

  console.log(`Analyzing ${topFiles.length} files...`);

  const fileContents = topFiles.map((f) => {
    const content = fs.readFileSync(f.path, "utf-8");
    return {
      path: f.path,
      complexity: f.complexity,
      lines: f.lines,
      content,
    };
  });

  const prompt = `
あなたはTypeScript/Next.jsの経験豊富なシニアエンジニアです．以下のコードベースを分析し，リファクタリング提案を行ってください．

【分析観点】
1. **コードの重複**（DRY原則違反）
2. **パフォーマンスの改善点**（不要な再レンダリング，メモ化の不足）
3. **型安全性の向上**（any型の削減，厳密な型定義）
4. **可読性の向上**（複雑な条件式の簡略化，命名の改善）
5. **エラーハンドリングの改善**（try-catchの適切な配置，エラーメッセージ）
6. **React/Next.js固有の問題**（useEffectの依存配列，Server/Client Componentの適切な使い分け）

【出力形式】
以下のMarkdown形式で出力してください：

\`\`\`markdown
# 🤖 週次リファクタリング提案（Gemini AI）

## 📊 分析サマリー

- 分析対象: ${topFiles.length}ファイル
- 提案数: X件
- 推定改善効果: [高/中/低]

---

## 提案1: [簡潔なタイトル]

**対象ファイル**: \`path/to/file.tsx\`

**複雑度**: ${fileContents[0].complexity} | **行数**: ${fileContents[0].lines}

### 問題点

[具体的な問題の説明]

### 改善案

[どのように改善するか]

### コード例

**Before**:
\`\`\`typescript
// 既存コード
\`\`\`

**After**:
\`\`\`typescript
// 改善後のコード
\`\`\`

### 期待効果

- [効果1]
- [効果2]

---

[提案2以降も同じ形式]
\`\`\`

【重要な制約】
- 提案は具体的で実装可能なものにしてください
- コード例は実際に動作するものを提示してください
- 各提案は独立して適用可能にしてください
- 優先度の高い提案から順に記載してください

---

【対象ファイル】

${fileContents
  .map(
    (f) => `
### ${f.path}
**複雑度**: ${f.complexity} | **行数**: ${f.lines}

\`\`\`typescript
${f.content}
\`\`\`
`
  )
  .join("\n---\n")}
`;

  try {
    const result = await model.generateContent(prompt);
    const suggestions = result.response.text();

    // 出力をファイルに保存
    fs.writeFileSync("refactor-suggestions.md", suggestions, "utf-8");

    console.log("✅ Refactoring suggestions generated successfully!");
    console.log(`📄 Output: refactor-suggestions.md`);

    return suggestions;
  } catch (error) {
    console.error("❌ Failed to generate suggestions:", error.message);
    process.exit(1);
  }
}

async function main() {
  console.log("🔍 Step 1: Extracting changed files from Git history...");
  const changedFiles = getChangedFiles();

  if (changedFiles.length === 0) {
    console.log("ℹ️ No changes detected in the past week. Exiting.");
    process.exit(0);
  }

  console.log(`✅ Found ${changedFiles.length} changed files`);

  console.log("\n📊 Step 2: Analyzing code complexity...");
  const analyzed = analyzeComplexity(changedFiles);

  console.log(`✅ Analyzed ${analyzed.length} files`);
  analyzed.slice(0, 5).forEach((f, i) => {
    console.log(
      `  ${i + 1}. ${f.path} (complexity: ${f.complexity}, score: ${f.score.toFixed(2)})`
    );
  });

  const maxFiles = parseInt(process.env.MAX_FILES || "15", 10);

  console.log(
    `\n🤖 Step 3: Generating refactoring suggestions with Gemini (max ${maxFiles} files)...`
  );
  await generateRefactoringSuggestions(analyzed, maxFiles);

  console.log("\n✨ All done!");
}

main().catch((error) => {
  console.error("💥 Fatal error:", error);
  process.exit(1);
});
