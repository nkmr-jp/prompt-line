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

export function renderFrontmatter(container: HTMLElement, frontmatter: string): void {
  const lines = frontmatter.split('\n');

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) {
      appendWithMarkdownLinks(container, line);
      container.appendChild(document.createElement('br'));
      continue;
    }

    const key = line.substring(0, colonIndex).trim();
    const value = line.substring(colonIndex + 1).trim();

    const lineDiv = document.createElement('div');
    lineDiv.className = 'frontmatter-line';

    const keySpan = document.createElement('span');
    keySpan.className = 'frontmatter-key';
    keySpan.textContent = key + ': ';
    lineDiv.appendChild(keySpan);

    if (value.startsWith('http')) {
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
