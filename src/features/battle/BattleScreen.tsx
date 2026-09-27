import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Eye, Hand, Heart, Layers, Moon, Sandwich, Sun, Timer } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { cardName, computeAuras, getCard, isNight, statsAt } from '../../engine';
import type { GameState, InPlay, LogEvent, Side, Stats } from '../../engine';
import { Card } from '../../ui/Card';
import { merendaLeft, TURN_SECONDS, useBattle } from './store';

const ICON = { strokeWidth: 2.75, size: 16 } as const;

export function BattleScreen({ onExit }: { onExit: () => void }) {
  const b = useBattle();
  const [detail, setDetail] = useState<{ card: InPlay; stats: Stats | null } | null>(null);
  const [showLog, setShowLog] = useState(false);
  const shown = b.revealState ?? b.state;
  const auras = useMemo(() => (shown ? computeAuras(shown) : null), [shown]);

  if (!shown || !b.state || !auras) return null;
  const state = b.state;
  const me = shown.players[0];
  const bot = shown.players[1];
  const night = isNight(shown.round);
  const choosing = b.phase === 'choosing' && state.winner === null;
  const left = merendaLeft(state, b.pending);
  const pendingBySlot = new Map(b.pending.map((p) => [p.slot, p.uid]));
  const selectedDef = b.selected ? getCard(state.players[0].hand.find((c) => c.uid === b.selected)!.defId) : null;
  const visibleHistory = b.history.slice(0, b.history.length - (b.lastLog.length - b.played));
  // Números flutuantes só durante a resolução, para as últimas entradas que tocaram.
  const recent =
    b.phase === 'resolving' ? b.lastLog.map((e, i) => ({ e, i })).slice(Math.max(0, b.played - 3), b.played) : [];

  const openDetail = (side: Side, slot: number) => {
    const card = shown.players[side].row[slot];
    if (card) setDetail({ card, stats: statsAt(shown, side, slot, auras) });
  };

  const onMySlot = (slot: number) => {
    if (!choosing) return openDetail(0, slot);
    if (pendingBySlot.has(slot)) return b.unplace(slot);
    if (b.selected && !me.row[slot]) return b.placeAt(slot);
    openDetail(0, slot);
  };
  const onBotSlot = (slot: number) => {
    if (choosing && b.tapMode) return b.tapAt(slot);
    openDetail(1, slot);
  };

  return (
    <div className={`battle ${night ? 'is-night' : 'is-day'}`}>
      <div className="battle-main">
        <div className="battle-topbar">
          <button className="btn btn-ghost" onClick={onExit} aria-label="Sair da partida">
            <ArrowLeft {...ICON} /> Banca
          </button>
          <Clock round={shown.round} night={night} />
          <TurnTimer key={`${state.round}-${b.phase}`} active={choosing} onTimeout={b.confirm} />
        </div>

        <Hud label="Bot" player={bot} handCount={bot.hand.length} />
        <Row
          side={1}
          state={shown}
          auras={auras}
          recent={recent}
          revealing={b.phase === 'revealing'}
          tapSlot={b.tapSlot}
          targetable={choosing && b.tapMode}
          onSlot={onBotSlot}
        />

        <div className="battle-divider">
          <span>{night ? 'Noite no recreio' : 'Dia no recreio'}</span>
        </div>

        <Row
          side={0}
          state={shown}
          auras={auras}
          recent={recent}
          revealing={b.phase === 'revealing'}
          pending={b.pending.map((p) => ({ slot: p.slot, defId: state.players[0].hand.find((c) => c.uid === p.uid)!.defId }))}
          targetable={choosing && !!b.selected}
          onSlot={onMySlot}
        />
        <Hud label="Você" player={me} handCount={me.hand.length} merendaLeft={choosing ? left : undefined} />

        {me.peek && (
          <p className="peek">
            <Eye {...ICON} /> Carro de som: o bot tem <b>{cardName(me.peek)}</b> na mão.
          </p>
        )}

        <div className="actions">
          <button
            className={`btn btn-secondary ${b.tapMode ? 'is-active' : ''}`}
            disabled={!choosing || me.tapas <= 0}
            onClick={() => b.setTapMode(!b.tapMode)}
            aria-pressed={b.tapMode}
          >
            <Hand {...ICON} /> {b.tapSlot !== undefined ? `Tapa na ${b.tapSlot + 1}` : 'Tapa'}
          </button>
          <button className="btn btn-primary btn-bafo" disabled={!choosing} onClick={b.confirm}>
            Bafo!
          </button>
          <button className="btn btn-secondary log-toggle" onClick={() => setShowLog((v) => !v)}>
            Log
          </button>
        </div>
        <p className="hint" aria-live="polite">
          {b.error ??
            (state.winner !== null
              ? 'Fim de jogo.'
              : b.phase === 'revealing'
              ? 'Bafo! Revelando...'
              : !choosing
                ? 'Resolvendo a rodada...'
                : b.tapMode
                  ? 'Escolha uma carteira do bot. Acerta se ele jogar carta nova ali.'
                  : b.selected
                    ? 'Toque numa carteira vazia sua.'
                    : `Escolha até 2 cartas (${left} de Merenda livre) e aperte Bafo!`)}
        </p>

        <HandView hand={state.players[0].hand} pending={b.pending.map((p) => p.uid)} selected={b.selected} merenda={left} onSelect={b.select} disabled={!choosing} />
        {selectedDef && (
          <div className="selected-detail">
            <Card card={selectedDef} size="full" />
          </div>
        )}
      </div>

      <aside className={`battle-log ${showLog ? 'is-open' : ''}`}>
        <h4>O que rolou</h4>
        <LogList events={visibleHistory} />
      </aside>

      <AnimatePresence>
        {b.phase === 'revealing' && (
          <motion.div
            className="bafo-flash"
            initial={{ scale: 0.4, opacity: 0, rotate: -12 }}
            animate={{ scale: 1, opacity: 1, rotate: -4 }}
            exit={{ scale: 1.6, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 14 }}
          >
            Bafo!
          </motion.div>
        )}
      </AnimatePresence>

      {detail && (
        <div className="dialog-backdrop" onClick={() => setDetail(null)}>
          <div className="dialog card-dialog" onClick={(e) => e.stopPropagation()}>
            <Card card={getCard(detail.card.defId)} stats={detail.stats} size="full" />
            {detail.card.damage > 0 && <p className="text-muted">Dano acumulado: {detail.card.damage}</p>}
            <div className="dialog-actions">
              <button className="btn btn-primary" onClick={() => setDetail(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {state.winner !== null && b.phase === 'choosing' && (
        <ResultDialog winner={state.winner} onAgain={() => b.start(b.playerDeck)} onExit={onExit} />
      )}
    </div>
  );
}

function Clock({ round, night }: { round: number; night: boolean }) {
  return (
    <span className="clock" title={night ? 'Noite' : 'Dia'}>
      {night ? <Moon {...ICON} /> : <Sun {...ICON} />} Rodada {round}
    </span>
  );
}

function TurnTimer({ active, onTimeout }: { active: boolean; onTimeout: () => void }) {
  const [left, setLeft] = useState(TURN_SECONDS);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [active]);
  useEffect(() => {
    if (active && left <= 0) onTimeout();
  }, [active, left, onTimeout]);
  return (
    <span className={`timer ${left <= 5 && active ? 'is-low' : ''}`} aria-label="Tempo para jogar">
      <Timer {...ICON} /> {active ? `${Math.max(0, left)}s` : '…'}
    </span>
  );
}

function Hud({
  label,
  player,
  handCount,
  merendaLeft,
}: {
  label: string;
  player: GameState['players'][number];
  handCount: number;
  merendaLeft?: number;
}) {
  return (
    <div className="hud">
      <strong className="hud-name">{label}</strong>
      <span className="hud-item moral" title="Moral">
        <Heart {...ICON} /> {player.moral}
      </span>
      <span className="hud-item" title="Merenda">
        <Sandwich {...ICON} /> {merendaLeft ?? player.merenda}
      </span>
      <span className="hud-item" title="Tapas">
        <Hand {...ICON} /> {player.tapas}
      </span>
      <span className="hud-item" title="Mão / deck">
        <Layers {...ICON} /> {handCount}/{player.deck.length}
      </span>
    </div>
  );
}

interface RowProps {
  side: Side;
  state: GameState;
  auras: ReturnType<typeof computeAuras>;
  recent: { e: LogEvent; i: number }[];
  revealing: boolean;
  pending?: { slot: number; defId: string }[];
  tapSlot?: number;
  targetable: boolean;
  onSlot: (slot: number) => void;
}

function Row({ side, state, auras, recent, revealing, pending = [], tapSlot, targetable, onSlot }: RowProps) {
  const p = state.players[side];
  return (
    <div className={`row row-${side === 0 ? 'me' : 'bot'}`}>
      {p.row.map((card, slot) => {
        const pend = pending.find((x) => x.slot === slot);
        const floaters = recent.flatMap(({ e, i }) => {
          if ((e.type === 'damage' || e.type === 'heal') && e.side === side && e.slot === slot)
            return [{ i, kind: e.type, label: e.type === 'damage' ? `-${e.amount}` : `+${e.amount}` }];
          if (e.type === 'fight' && e.amount > 0 && e.side !== side && e.targetSlot === slot)
            return [{ i, kind: 'damage', label: `-${e.amount}` }];
          return [];
        });
        const isNew = revealing && card && card.enteredRound === state.round;
        return (
          <button
            key={slot}
            className={`slot ${card ? 'has-card' : 'is-empty'} ${targetable && !card ? 'is-target' : ''} ${
              targetable && side === 1 ? 'is-target' : ''
            } ${tapSlot === slot ? 'is-tapped' : ''} ${pend ? 'is-pending' : ''}`}
            onClick={() => onSlot(slot)}
            aria-label={`Carteira ${slot + 1}${card ? `: ${cardName(card)}` : ''}`}
          >
            <span className="slot-number">{slot + 1}</span>
            {card && (
              <motion.div
                key={card.uid}
                className="slot-card"
                initial={isNew ? { rotateY: 180, scale: 0.9 } : false}
                animate={{ rotateY: 0, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.25 }}
              >
                <Card card={getCard(card.defId)} stats={statsAt(state, side, slot, auras)} size="mini" className={card.flipped ? 'is-flipped' : ''} />
              </motion.div>
            )}
            {!card && pend && (
              <div className="slot-card pending-card">
                <Card card={getCard(pend.defId)} size="mini" />
              </div>
            )}
            {tapSlot === slot && (
              <span className="tap-mark" aria-label="Tapa marcado">
                <Hand {...ICON} />
              </span>
            )}
            <AnimatePresence>
              {floaters.map(({ i, kind, label }) => (
                <motion.span
                  key={i}
                  className={`floater ${kind}`}
                  initial={{ y: 8, opacity: 0, scale: 0.6 }}
                  animate={{ y: -24, opacity: 1, scale: 1.2 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  {label}
                </motion.span>
              ))}
            </AnimatePresence>
          </button>
        );
      })}
    </div>
  );
}

function HandView({
  hand,
  pending,
  selected,
  merenda,
  onSelect,
  disabled,
}: {
  hand: { uid: string; defId: string }[];
  pending: string[];
  selected: string | null;
  merenda: number;
  onSelect: (uid: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="hand" role="list" aria-label="Sua mão">
      {hand
        .filter((c) => !pending.includes(c.uid))
        .map((c) => {
          const def = getCard(c.defId);
          const affordable = def.cost <= merenda;
          return (
            <motion.button
              layout
              key={c.uid}
              role="listitem"
              className={`hand-card ${selected === c.uid ? 'is-selected' : ''} ${affordable ? '' : 'is-expensive'}`}
              onClick={() => onSelect(c.uid)}
              disabled={disabled}
              aria-pressed={selected === c.uid}
              whileHover={{ y: -6 }}
            >
              <Card card={def} size="mini" />
            </motion.button>
          );
        })}
    </div>
  );
}

function LogList({ events }: { events: LogEvent[] }) {
  const items = events.filter((e) => e.type !== 'draw').slice(-80);
  useEffect(() => {
    document.querySelector('.log-end')?.scrollIntoView({ block: 'nearest' });
  }, [items.length]);
  return (
    <ol className="log">
      {items.map((e, i) => (
        <li key={i} className={`log-${e.type} ${'side' in e ? (e.side === 0 ? 'log-me' : 'log-bot') : ''}`}>
          {'side' in e && <span className="log-who">{e.side === 0 ? 'Você' : 'Bot'}</span>}
          {e.text}
        </li>
      ))}
      <li className="log-end" aria-hidden />
    </ol>
  );
}

function ResultDialog({ winner, onAgain, onExit }: { winner: GameState['winner']; onAgain: () => void; onExit: () => void }) {
  const title = winner === 'draw' ? 'Empate!' : winner === 0 ? 'Vitória!' : 'Derrota...';
  const body =
    winner === 'draw'
      ? 'Os dois zeraram a Moral juntos. Bafo de respeito.'
      : winner === 0
        ? 'Você ganhou o recreio. A banca do Seu Zé vai ficar sabendo.'
        : 'Hoje não deu. Amanhã tem recreio de novo.';
  return (
    <div className="dialog-backdrop">
      <motion.div className="dialog result" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
        <h2 className="dialog-title">{title}</h2>
        <p className="dialog-body">{body}</p>
        <div className="dialog-actions">
          <button className="btn btn-secondary" onClick={onExit}>
            Voltar pra banca
          </button>
          <button className="btn btn-primary" onClick={onAgain}>
            Jogar de novo
          </button>
        </div>
      </motion.div>
    </div>
  );
}
