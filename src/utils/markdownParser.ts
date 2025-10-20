import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/core';

// Import only commonly used languages to keep bundle size down
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import sql from 'highlight.js/lib/languages/sql';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';

// Register languages
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('json', json);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('css', css);

/**
 * Preprocess markdown to fix common formatting issues, particularly with tables
 * This handles cases where LLMs generate invalid markdown table syntax
 */
function preprocessMarkdown(text: string): string {
  // Check if text contains tables
  const hasTables = text.includes('|');

  if (!hasTables) {
    return text;
  }

  // Process line by line
  const originalLines = text.split('\n');
  const fixedLines: string[] = [];
  let firstTableRowSeen = false;

  for (let i = 0; i < originalLines.length; i++) {
    let line = originalLines[i];

    // Check if this is an empty table row (only pipes and whitespace)
    if (line.includes('|')) {
      const cellContent = line
        .split('|')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const isEmptyRow = cellContent.length === 0 || cellContent.every((cell) => cell === '' || cell === '-');

      if (isEmptyRow && !line.includes('-')) {
        continue; // Skip this line
      }
    }

    // Check if this line is a table separator row (has pipes and dashes)
    if (line.includes('|') && line.includes('-')) {
      const isSeparator = /^\s*\|[\s-:|]+\|\s*$/.test(line);
      if (isSeparator) {
        // Count columns from the line
        const cols = line.split('|').filter((s) => s.trim().length > 0 || s.includes('-')).length;
        const replacement = '| ' + '--- | '.repeat(cols - 1) + '--- |';
        line = replacement;
      }
    }

    fixedLines.push(line);

    // Only add a separator after the FIRST table row (header) if it doesn't have one
    if (line.trim().startsWith('|') && line.trim().endsWith('|') && !line.includes('-') && !firstTableRowSeen) {
      firstTableRowSeen = true;
      const nextLine = originalLines[i + 1];
      // If next line exists and is NOT a separator (check before it's processed)
      if (nextLine && !(nextLine.includes('|') && nextLine.includes('-'))) {
        const cols = line.split('|').filter((s) => s.trim().length > 0).length;
        const separator = '| ' + '--- | '.repeat(cols - 1) + '--- |';
        fixedLines.push(separator);
      }
    }
  }

  return fixedLines.join('\n');
}

interface MarkdownParserOptions {
  sanitize?: boolean;
  highlight?: boolean;
  breaks?: boolean;
}

export class MarkdownParser {
  private md: MarkdownIt;
  private sanitize: boolean;

  constructor(options: MarkdownParserOptions = {}) {
    this.sanitize = options.sanitize !== false; // Default true

    // Configure markdown-it
    this.md = new MarkdownIt({
      html: !this.sanitize, // Only allow HTML if not sanitizing
      linkify: true,
      typographer: true,
      breaks: options.breaks !== false, // Default true for better line break handling
      highlight: options.highlight !== false ? this.highlightCode.bind(this) : undefined,
    });
  }

  private highlightCode(str: string, lang: string): string {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return '<pre class="hljs"><code>' + hljs.highlight(str, { language: lang, ignoreIllegals: true }).value + '</code></pre>';
      } catch (err) {
        console.error('Syntax highlighting error:', err);
      }
    }

    // Use default escaping
    try {
      return '<pre class="hljs"><code>' + this.md.utils.escapeHtml(str) + '</code></pre>';
    } catch (err) {
      return '<pre><code>' + this.escapeHtml(str) + '</code></pre>';
    }
  }

  parse(markdown: string): string {
    try {
      // Input validation
      if (markdown === null || markdown === undefined) {
        return '';
      }

      if (typeof markdown !== 'string') {
        console.warn('MarkdownParser received non-string input:', typeof markdown);
        return this.escapeHtml(String(markdown));
      }

      if (markdown.trim() === '') {
        return '';
      }

      // Preprocess markdown to fix common issues (like invalid tables)
      const preprocessedMarkdown = preprocessMarkdown(markdown);

      // Parse markdown
      let html = this.md.render(preprocessedMarkdown);

      // Sanitize if enabled
      if (this.sanitize) {
        html = DOMPurify.sanitize(html, {
          ALLOWED_TAGS: [
            'p',
            'br',
            'strong',
            'em',
            'u',
            's',
            'code',
            'pre',
            'a',
            'ul',
            'ol',
            'li',
            'blockquote',
            'h1',
            'h2',
            'h3',
            'h4',
            'h5',
            'h6',
            'table',
            'thead',
            'tbody',
            'tr',
            'th',
            'td',
            'hr',
            'img',
            'span',
            'div',
          ],
          ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'src', 'alt', 'title'],
          ALLOW_DATA_ATTR: false,
          ADD_ATTR: ['target'], // Ensure target attribute for links
        });
      }

      return html;
    } catch (error) {
      console.error('Markdown parsing error:', error);
      // Fallback: return escaped plain text
      return this.escapeHtml(markdown);
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Export singleton instances with different configurations
export const defaultMarkdownParser = new MarkdownParser({
  sanitize: true,
  highlight: true,
  breaks: true,
});

export const unsafeMarkdownParser = new MarkdownParser({
  sanitize: false,
  highlight: true,
  breaks: true,
});

// Export a helper function for easy use
export function parseMarkdown(markdown: string, options?: { renderHTML?: boolean }): string {
  const parser = options?.renderHTML ? unsafeMarkdownParser : defaultMarkdownParser;
  return parser.parse(markdown);
}
