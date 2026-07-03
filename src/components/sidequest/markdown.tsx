"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { SQ, FONT } from "./tokens";

export interface MarkdownViewProps {
  content: string;
}

// Light, theme-matched renderers for the markdown element set the backend emits
// (headings / paragraphs / lists / links / blockquote / images / code / tables).
const components: Components = {
  h1: ({ children }) => (
    <h1
      style={{
        fontFamily: FONT.sans,
        fontWeight: 800,
        fontSize: 24,
        lineHeight: 1.2,
        color: SQ.ink,
        margin: "22px 0 12px",
      }}
    >
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2
      style={{
        fontFamily: FONT.sans,
        fontWeight: 800,
        fontSize: 19,
        lineHeight: 1.25,
        color: SQ.ink,
        margin: "20px 0 10px",
      }}
    >
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3
      style={{
        fontFamily: FONT.sans,
        fontWeight: 700,
        fontSize: 16,
        lineHeight: 1.3,
        color: SQ.ink,
        margin: "16px 0 8px",
      }}
    >
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p style={{ fontSize: 14, lineHeight: 1.65, color: SQ.faint, margin: "0 0 12px" }}>
      {children}
    </p>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: SQ.ember, textDecoration: "underline", fontWeight: 600 }}
    >
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul
      style={{
        margin: "0 0 12px",
        paddingLeft: 22,
        fontSize: 14,
        lineHeight: 1.6,
        color: SQ.faint,
      }}
    >
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol
      style={{
        margin: "0 0 12px",
        paddingLeft: 22,
        fontSize: 14,
        lineHeight: 1.6,
        color: SQ.faint,
      }}
    >
      {children}
    </ol>
  ),
  li: ({ children }) => <li style={{ margin: "3px 0" }}>{children}</li>,
  blockquote: ({ children }) => (
    <blockquote
      style={{
        margin: "0 0 12px",
        padding: "4px 0 4px 14px",
        borderLeft: `3px solid ${SQ.hairline}`,
        color: SQ.mute,
        fontStyle: "italic",
      }}
    >
      {children}
    </blockquote>
  ),
  img: ({ src, alt }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={typeof src === "string" ? src : undefined}
      alt={alt ?? ""}
      style={{ maxWidth: "100%", height: "auto", borderRadius: 8, margin: "8px 0" }}
    />
  ),
  code: ({ children }) => (
    <code
      style={{
        fontFamily: FONT.mono,
        fontSize: 12.5,
        background: SQ.inset,
        border: `1px solid ${SQ.hairlineSoft}`,
        borderRadius: 4,
        padding: "1px 5px",
      }}
    >
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre
      style={{
        fontFamily: FONT.mono,
        fontSize: 12.5,
        background: SQ.inset,
        border: `1px solid ${SQ.hairlineSoft}`,
        borderRadius: 8,
        padding: 12,
        overflowX: "auto",
        margin: "0 0 12px",
      }}
    >
      {children}
    </pre>
  ),
  hr: () => <hr style={{ border: "none", borderTop: `1px solid ${SQ.hairline}`, margin: "18px 0" }} />,
};

/** Renders backend markdown (announcement bodies etc.) with light SQ-themed styling. */
export function MarkdownView({ content }: MarkdownViewProps) {
  return (
    <div style={{ color: SQ.faint }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
