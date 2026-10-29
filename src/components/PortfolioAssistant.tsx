import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { requestAnswer } from '../lib/portfolio/client';
import { LIMITS, type AskResponse } from '../lib/portfolio/types';

const suggestions = [
  'What did Jorge build with Blazor?',
  'What is the status of the machine-learning program?',
  'What was his contribution to the cattle-ranch research?',
];
export default function PortfolioAssistant({
  endpoint,
}: {
  endpoint: string | null;
}) {
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AskResponse | null>(null);
  const [message, setMessage] = useState('');
  const [waitUntil, setWaitUntil] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const inFlight = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!waitUntil) return;
    setWaiting(true);
    const timer = setTimeout(
      () => setWaiting(false),
      Math.max(0, waitUntil - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [waitUntil]);
  useEffect(() => {
    if (result) resultHeading.current?.focus();
  }, [result]);
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !endpoint ||
      inFlight.current ||
      Date.now() < waitUntil ||
      !question.trim()
    )
      return;
    inFlight.current = true;
    setBusy(true);
    setResult(null);
    setMessage('Finding relevant public passages…');
    const abort = new AbortController();
    controller.current = abort;
    const timeout = setTimeout(() => abort.abort(), 20_000);
    try {
      const answer = await requestAnswer(endpoint, question, abort.signal);
      setResult(answer);
      setMessage('');
      setWaitUntil(Date.now() + 5_000);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unavailable';
      setMessage(
        reason === 'invalid'
          ? 'Please enter one question of 1–500 characters using plain text.'
          : reason === 'rate_limited'
            ? 'The request limit has been reached. Wait a minute before submitting again, or browse the source pages below.'
            : 'The assistant is unavailable or its free allowance has been reached. You can browse the source pages below. Wait a minute before submitting again.',
      );
      setWaitUntil(Date.now() + (reason === 'invalid' ? 5_000 : 60_000));
    } finally {
      clearTimeout(timeout);
      inFlight.current = false;
      setBusy(false);
      controller.current = null;
    }
  }
  return (
    <div className="portfolio-assistant">
      {!endpoint && (
        <p className="assistant-notice" role="status">
          The assistant is not yet activated. You can explore the public source
          pages below.
        </p>
      )}
      <form onSubmit={submit} aria-label="Ask about the portfolio">
        <label htmlFor="portfolio-question">Your question</label>
        <p id="question-help">
          Ask about the published projects, background, or research. Please
          leave out personal, confidential, or agency information.
        </p>
        <textarea
          ref={input}
          id="portfolio-question"
          rows={4}
          maxLength={LIMITS.question}
          required
          disabled={!endpoint || busy}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          aria-describedby="question-help question-count assistant-privacy"
        />
        <p className="assistant-count" id="question-count">
          {question.length} / {LIMITS.question} characters
        </p>
        <div className="assistant-actions">
          <button
            type="submit"
            disabled={!endpoint || busy || waiting || !question.trim()}
          >
            {busy
              ? 'Finding sources…'
              : waiting
                ? 'Please wait before asking again'
                : 'Ask a question'}
          </button>
          <button
            type="button"
            className="assistant-clear"
            disabled={busy || (!question && !result && !message)}
            onClick={() => {
              setQuestion('');
              setResult(null);
              setMessage('');
              input.current?.focus();
            }}
          >
            Clear
          </button>
        </div>
        <p className="assistant-privacy" id="assistant-privacy">
          When activated, your question is sent to Cloudflare Workers AI. This
          site does not save conversation history.{' '}
          <a href="/colophon/#portfolio-assistant-privacy">Privacy details</a>.
        </p>
      </form>
      <div className="assistant-suggestions" aria-label="Suggested questions">
        <p className="eyebrow">A place to start</p>
        <ul>
          {suggestions.map((suggestion) => (
            <li key={suggestion}>
              <button
                type="button"
                disabled={!endpoint || busy}
                onClick={() => {
                  setQuestion(suggestion);
                  input.current?.focus();
                }}
              >
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="assistant-status"
      >
        {message}
      </p>
      {result && (
        <section className="assistant-result" aria-labelledby="answer-heading">
          <h2 ref={resultHeading} id="answer-heading" tabIndex={-1}>
            {result.status === 'answered'
              ? 'From the public sources'
              : 'No supported answer'}
          </h2>
          {result.answer.split('\n\n').map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
          {result.references.length > 0 && (
            <>
              <h3>Read the original pages</h3>
              <ul>
                {result.references.map((source) => (
                  <li key={source.url}>
                    <a href={source.url}>{source.title}</a>
                  </li>
                ))}
              </ul>
              <p className="assistant-caption">
                AI selected these published passages. Check the original pages
                for context; a selection may not answer every part of your
                question.
              </p>
            </>
          )}
        </section>
      )}
    </div>
  );
}
