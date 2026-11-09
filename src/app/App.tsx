import { useEffect, useMemo, useState } from 'react';
import { defaultState, makeDesign, type Design, type DesignState } from './design';
import { BoardPreview, Notices } from './parts';
import { PlanStep } from './PlanStep';
import { PatternStep, ShopStep, TuneStep, WoodStep } from './steps';
import { formatLength } from '../engine';

const STEPS = ['Your shop', 'Your wood', 'Pattern', 'Size', 'Cut list'] as const;
const STORAGE_KEY = 'cutting-board-designer/v1';

function loadState(): DesignState {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...defaultState, ...(JSON.parse(saved) as Partial<DesignState>) };
  } catch {
    // Storage is unavailable or the saved design is unreadable: start fresh.
  }
  return defaultState;
}

export type Update = (changes: Partial<DesignState>) => void;

export function App() {
  const [state, setState] = useState<DesignState>(loadState);
  const [step, setStep] = useState(0);
  const update: Update = (changes) => setState((current) => ({ ...current, ...changes }));

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // The design still works for this visit; it just will not be remembered.
    }
  }, [state]);

  const result = useMemo((): { design: Design | null; error: string | null } => {
    try {
      return { design: makeDesign(state), error: null };
    } catch (problem) {
      return { design: null, error: problem instanceof Error ? problem.message : 'This design cannot be built.' };
    }
  }, [state]);
  const { design, error } = result;

  const go = (next: number): void => {
    setStep(Math.max(0, Math.min(STEPS.length - 1, next)));
    window.scrollTo({ top: 0 });
  };
  const showPreview = step >= 1 && step <= 3;
  const show = (mm: number): string => formatLength(mm, state.unit);

  return (
    <div className="app">
      <header className="top">
        <h1>Cutting Board Designer</h1>
        <button
          type="button"
          className="link"
          onClick={() => {
            if (window.confirm('Start a new design? Your current choices will be cleared.')) {
              setState(defaultState);
              go(0);
            }
          }}
        >
          Start over
        </button>
      </header>

      <nav aria-label="Steps">
        <ol className="stepper">
          {STEPS.map((name, index) => (
            <li key={name}>
              <button
                type="button"
                className={index === step ? 'current' : index < step ? 'done' : ''}
                aria-current={index === step ? 'step' : undefined}
                onClick={() => go(index)}
              >
                <span className="number">{index + 1}</span>
                {name}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <main className={showPreview ? 'layout with-preview' : 'layout'}>
        <section className="step">
          {step === 0 && <ShopStep state={state} update={update} />}
          {step === 1 && <WoodStep state={state} update={update} />}
          {step === 2 && <PatternStep state={state} update={update} />}
          {step === 3 && <TuneStep state={state} update={update} design={design} />}
          {step === 4 && <PlanStep state={state} update={update} design={design} error={error} />}

          <div className="step-nav">
            {step > 0 && (
              <button type="button" onClick={() => go(step - 1)}>
                Back
              </button>
            )}
            {step < STEPS.length - 1 && (
              <button type="button" className="primary" onClick={() => go(step + 1)}>
                Next: {STEPS[step + 1]}
              </button>
            )}
            {step === STEPS.length - 1 && design && (
              <button type="button" className="primary" onClick={() => window.print()}>
                {state.showGuide ? 'Print instructions' : 'Print cut list'}
              </button>
            )}
          </div>
        </section>

        {showPreview && (
          <aside className="preview" aria-live="polite">
            <h2>Your board</h2>
            {design ? (
              <>
                <BoardPreview
                  board={design.board}
                  label={`Preview of the board: ${design.columns} by ${design.rows} pieces`}
                />
                <p className="size">
                  {show(design.board.length)} × {show(design.board.width)} × {show(design.board.thickness)} thick
                </p>
                <Notices notices={design.notices} />
              </>
            ) : (
              <p className="empty">{error}</p>
            )}
          </aside>
        )}
      </main>
    </div>
  );
}
