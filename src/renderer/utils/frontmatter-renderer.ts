/**
 * Shared utility for rendering frontmatter tooltip content
 */

const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;

/**
 * Append text with Markdown link syntax [text](url) rendered as clickable <a> elements.
 * Non-link text is appended as text nodes.
 */
function appendWithMarkdownLinks(container: HTMLElement, text: string): void {
  MARKDOWN_LINK_PATTERN.lastIndex = 0;
  let lastIndex = 0;
  let match;

  while ((match = MARKDOWN_LINK_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      container.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
    }
    const label = match[1]!;
    const url = match[2]!;
    const link = document.createElement('a');
    link.href = url;
    link.textContent = label;
    link.className = 'frontmatter-link';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.electronAPI?.shell?.openExternal?.(url);
    });
    container.appendChild(link);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    container.appendChild(document.createTextNode(text.slice(lastIndex)));
  }
}

const KEY_VALUE_PATTERN = /^([\w-]+):\s*(.*)/;

export function renderFrontmatter(container: HTMLElement, frontmatter: string): void {
  const lines = frontmatter.split('\n');

  for (const line of lines) {
    const kvMatch = KEY_VALUE_PATTERN.exec(line);
    if (!kvMatch) {
      appendWithMarkdownLinks(container, line);
      container.appendChild(document.createElement('br'));
      continue;
    }

    const key = kvMatch[1]!;
    const value = kvMatch[2]!;

    const lineDiv = document.createElement('div');
    lineDiv.className = 'frontmatter-line';

    const keySpan = document.createElement('span');
    keySpan.className = 'frontmatter-key';
    keySpan.textContent = key + ': ';
    lineDiv.appendChild(keySpan);

    if (/^https?:\/\//.test(value)) {
      const link = document.createElement('a');
      link.href = value;
      link.textContent = value;
      link.className = 'frontmatter-link';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.electronAPI?.shell?.openExternal?.(value);
      });
      lineDiv.appendChild(link);
    } else {
      const valueSpan = document.createElement('span');
      valueSpan.className = 'frontmatter-value';
      appendWithMarkdownLinks(valueSpan, value);
      lineDiv.appendChild(valueSpan);
    }

    container.appendChild(lineDiv);
  }
}
