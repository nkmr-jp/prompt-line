/**
 * Shared utility for rendering frontmatter tooltip content
 */

export function renderFrontmatter(container: HTMLElement, frontmatter: string): void {
  const lines = frontmatter.split('\n');

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) {
      container.appendChild(document.createTextNode(line));
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
      valueSpan.textContent = value;
      lineDiv.appendChild(valueSpan);
    }

    container.appendChild(lineDiv);
  }
}
