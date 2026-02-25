export function notesforgeToMarkdown(content: string): string {
  const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const output: string[] = [];
  let mode: "bullet" | "numbered" | "table" | "code" | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const marker = line.match(/^\s*(H[1-6]|PARAGRAPH|BULLET|NUMBERED|CODE|TABLE)\s*:\s*(.*)$/i);

    if (marker) {
      mode = null;
      const key = marker[1].toUpperCase();
      const payload = marker[2].trim();

      if (key.startsWith("H")) {
        const depth = Number(key.slice(1));
        output.push(`${"#".repeat(Math.max(1, Math.min(6, depth)))} ${payload}`);
      } else if (key === "PARAGRAPH") {
        output.push(payload);
      } else if (key === "BULLET") {
        mode = "bullet";
      } else if (key === "NUMBERED") {
        mode = "numbered";
      } else if (key === "TABLE") {
        mode = "table";
      } else if (key === "CODE") {
        mode = "code";
        output.push("```");
      }
      continue;
    }

    if (!line.trim()) {
      if (mode === "code") {
        output.push("```");
        mode = null;
      } else {
        output.push("");
      }
      continue;
    }

    if (mode === "bullet") {
      output.push(line.startsWith("-") ? line : `- ${line}`);
      continue;
    }
    if (mode === "numbered") {
      output.push(line);
      continue;
    }
    if (mode === "table") {
      output.push(line);
      continue;
    }
    if (mode === "code") {
      output.push(line);
      continue;
    }

    output.push(line);
  }

  if (mode === "code") {
    output.push("```");
  }

  return `${output.join("\n").trim()}\n`;
}
