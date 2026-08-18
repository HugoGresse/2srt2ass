import type { ComponentChildren } from 'preact';

/**
 * Render raw SRT cue text as styled Preact nodes for the preview,
 * interpreting <i>, <b>, <u> and <font color> the way a player would.
 * Unknown tags are dropped; everything else is plain text (no innerHTML).
 */
export function SubtitleText({ text }: { text: string }) {
  return <>{renderSegment(text)}</>;
}

interface StyleFlags {
  italic?: boolean;
  bold?: boolean;
  underline?: boolean;
  color?: string;
}

const TAG_RE = /<(\/?)(i|b|u|font)\b([^>]*)>/gi;

function renderSegment(text: string): ComponentChildren {
  const nodes: ComponentChildren[] = [];
  const stack: StyleFlags[] = [];
  let last = 0;

  const flush = (upTo: number) => {
    if (upTo <= last) return;
    const chunk = text.slice(last, upTo).replace(/<[^>\n]*>/g, '');
    if (chunk === '') return;
    nodes.push(applyStyles(chunk, stack, nodes.length));
  };

  TAG_RE.lastIndex = 0;
  for (let m = TAG_RE.exec(text); m !== null; m = TAG_RE.exec(text)) {
    flush(m.index);
    last = m.index + m[0].length;
    const closing = m[1] === '/';
    const tag = m[2]!.toLowerCase();
    if (closing) {
      // Pop the innermost frame set by this tag kind (lenient nesting).
      for (let i = stack.length - 1; i >= 0; i -= 1) {
        if (frameMatches(stack[i]!, tag)) {
          stack.splice(i, 1);
          break;
        }
      }
    } else if (tag === 'font') {
      const color = m[3]?.match(/color\s*=\s*["']?(#?\w+)["']?/i)?.[1];
      stack.push({ color: color ?? undefined });
    } else {
      stack.push({
        italic: tag === 'i' || undefined,
        bold: tag === 'b' || undefined,
        underline: tag === 'u' || undefined,
      });
    }
  }
  flush(text.length);

  return interleaveBreaks(nodes.length > 0 ? nodes : [text.replace(/<[^>\n]*>/g, '')]);
}

function frameMatches(frame: StyleFlags, tag: string): boolean {
  if (tag === 'i') return frame.italic === true;
  if (tag === 'b') return frame.bold === true;
  if (tag === 'u') return frame.underline === true;
  return frame.color !== undefined;
}

function applyStyles(chunk: string, stack: StyleFlags[], key: number): ComponentChildren {
  const merged = stack.reduce<StyleFlags>((acc, f) => ({ ...acc, ...f }), {});
  if (!merged.italic && !merged.bold && !merged.underline && !merged.color) {
    return chunk;
  }
  return (
    <span
      key={key}
      style={{
        fontStyle: merged.italic ? 'italic' : undefined,
        fontWeight: merged.bold ? 'bold' : undefined,
        textDecoration: merged.underline ? 'underline' : undefined,
        color: merged.color,
      }}
    >
      {chunk}
    </span>
  );
}

/** Split remaining newlines into <br /> elements. */
function interleaveBreaks(nodes: ComponentChildren[]): ComponentChildren[] {
  const out: ComponentChildren[] = [];
  nodes.forEach((node, i) => {
    if (typeof node === 'string') {
      const parts = node.split('\n');
      parts.forEach((part, j) => {
        if (j > 0) out.push(<br key={`br-${i}-${j}`} />);
        if (part !== '') out.push(part);
      });
    } else if (node && typeof node === 'object' && 'props' in node) {
      // Styled spans keep their own text; split newlines inside them too.
      const child = (node.props as { children?: unknown }).children;
      if (typeof child === 'string' && child.includes('\n')) {
        const parts = child.split('\n');
        parts.forEach((part, j) => {
          if (j > 0) out.push(<br key={`br-${i}-${j}`} />);
          out.push({ ...node, props: { ...node.props, children: part } });
        });
      } else {
        out.push(node);
      }
    } else {
      out.push(node);
    }
  });
  return out;
}
