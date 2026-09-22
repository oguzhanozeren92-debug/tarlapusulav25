import { useEffect, useState } from 'react';

import type {
  PusulaFieldAnswer,
  PusulaFieldQuestion as PusulaFieldQuestionValue,
  PusulaFieldQuestionOption,
} from '../hooks/usePusulaFieldCompletion';

import './PusulaFieldQuestion.css';

const BODY_SRC =
  'https://xwyfidtktauxivsosmex.supabase.co/storage/v1/object/public/pusula/compass-body.webp';

const NEEDLE_SRC =
  'https://xwyfidtktauxivsosmex.supabase.co/storage/v1/object/public/pusula/compass-needle-centered.webp';

type Props = {
  question: PusulaFieldQuestionValue;
  onAnswer: (value: PusulaFieldAnswer) => void | Promise<void>;
};

export default function PusulaFieldQuestion({ question, onAnswer }: Props) {
  const [savingValue, setSavingValue] = useState<string | null>(null);
  const [numberValue, setNumberValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setSavingValue(null);
    setNumberValue('');
    setError(null);
    setVisible(false);

    const timer = window.setTimeout(() => setVisible(true), 250);
    return () => window.clearTimeout(timer);
  }, [question.id]);

  const choose = async (option: PusulaFieldQuestionOption) => {
    if (savingValue) return;

    setSavingValue(option.value);
    setError(null);

    try {
      await onAnswer(option.value);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Cevap kaydedilemedi. Tekrar dener misin?',
      );
      setSavingValue(null);
    }
  };

  const saveNumber = async () => {
    if (savingValue || question.kind !== 'number') return;

    const normalized = numberValue.trim().replace(',', '.');
    const number = Number(normalized);

    if (!Number.isFinite(number)) {
      setError('Lütfen geçerli bir sayı gir.');
      return;
    }

    if (number < question.min || number > question.max) {
      setError(
        `Değer ${question.min} ile ${question.max} ${question.unit} arasında olmalı.`,
      );
      return;
    }

    setSavingValue('number');
    setError(null);

    try {
      await onAnswer(number);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Cevap kaydedilemedi. Tekrar dener misin?',
      );
      setSavingValue(null);
    }
  };

  if (!visible) return null;

  return (
    <aside className="tp-pusula-question" aria-live="polite">
      <div className="tp-pusula-question__logo" aria-hidden="true">
        <img className="tp-pusula-question__body" src={BODY_SRC} alt="" />
        <img className="tp-pusula-question__needle" src={NEEDLE_SRC} alt="" />
      </div>

      <div className="tp-pusula-question__panel">
        <div className="tp-pusula-question__heading">
          <strong>Pusula</strong>
          <span>Bir bilgiyi tamamlayalım</span>
        </div>

        <p className="tp-pusula-question__prompt">{question.prompt}</p>

        {question.helper && (
          <p className="tp-pusula-question__helper">{question.helper}</p>
        )}

        {question.kind === 'choice' ? (
          <div className="tp-pusula-question__options">
            {question.options.map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={Boolean(savingValue)}
                onClick={() => void choose(option)}
              >
                <span className="tp-pusula-question__option-copy">
                  <strong>
                    {savingValue === option.value
                      ? 'Kaydediliyor…'
                      : option.label}
                  </strong>
                  {option.hint ? (
                    <small>{option.hint}</small>
                  ) : null}
                </span>
                {option.recommended ? (
                  <span className="tp-pusula-question__recommended">
                    Pusula tahmini
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ) : (
          <div className="tp-pusula-question__number">
            <div className="tp-pusula-question__number-field">
              <input
                type="number"
                inputMode="decimal"
                min={question.min}
                max={question.max}
                step={question.step}
                value={numberValue}
                placeholder={question.placeholder}
                disabled={Boolean(savingValue)}
                onChange={(event) => {
                  setNumberValue(event.target.value);
                  setError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void saveNumber();
                  }
                }}
              />
              <span>{question.unit}</span>
            </div>

            <button
              type="button"
              className="tp-pusula-question__number-save"
              disabled={Boolean(savingValue) || !numberValue.trim()}
              onClick={() => void saveNumber()}
            >
              {savingValue === 'number' ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        )}

        {error && <p className="tp-pusula-question__error">{error}</p>}
      </div>
    </aside>
  );
}
