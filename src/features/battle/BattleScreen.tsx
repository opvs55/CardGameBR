import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Eye, Heart, Layers, Moon, Plus, Sandwich, Sun, Timer } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  canAttack,
  canPlay,
  canUsePower,
  cardName,
  computeAuras,
  getCard,
  getHero,
  isNight,
  KEYWORD_INFO,
  minionStats,
  roundOf,
} from '../../engine';
import type { CharRef, GameState, LogEvent, Minion, Side } from '../../engine';
import { Card } from '../../ui/Card';
import { TURN_SECONDS, useBattle } from './store';

const ICON = { strokeWidth: 2.75, size: 16 } as const;

const refKey = (r: CharRef) => (r.kind === 'hero' ? `hero-${r.side}` : r.uid);

export function BattleScreen({ onExit }: { onExit: () => void }) {
  const b = useBattle();
  const [detail, setDetail] = useState<Minion | null>(null);
  const [showLog, setShowLog] = useState(false);
  const state = b.state;
  const auras = useMemo(() => (state ? computeAuras(state) : null), [state]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && b.cancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [b]);

  if (!state || !auras) return null;
  const me = state.players[0];
  const myTurn = state.active === 0 && state.winner === null;
  const night = isNight(state.turn);
  const targets = new Set(b.mode.kind === 'target' ? b.mode.targets.map(refKey) : []);
  const selectedUid = b.mode.kind === 'place' || (b.mode.kind === 'target' && b.mode.action === 'play') ? b.mode.uid : null;
  const attackerUid = b.mode.kind === 'target' && b.mode.action === 'attack' ? b.mode.uid : null;
  const selectedDef = selectedUid ? getCard(me.hand.find((c) => c.uid === selectedUid)!.defId) : null;

  // Números flutuantes da última ação.
  const floaters = new Map<string, { label: string; kind: string; i: number }[]>();
  b.lastEvents.forEach((e, i) => {
    if (e.type !== 'damage' && e.type !== 'heal' && e.type !== 'shield') return;
    const k = refKey(e.to);
    const label = e.type === 'damage' ? `-${e.amount}` : e.type === 'heal' ? `+${e.amount}` : 'Capacete!';
    floaters.set(k, [...(floaters.get(k) ?? []), { label, kind: e.type, i }]);
  });

  const onMinion = (m: Minion, side: Side) => {
    if (b.mode.kind === 'target') return b.clickMinion(m.uid);
    if (side === 0 && myTurn && canAttack(state, m.uid)) return b.clickMinion(m.uid);
    setDetail(m);
  };

  const hint =
    b.error ??
    (state.winner !== null
      ? 'Fim de jogo.'
      : !myTurn
        ? 'Vez do bot...'
        : b.mode.kind === 'place'
          ? 'Toque num dos espaços da sua mesa para colocar a carta.'
          : b.mode.kind === 'target'
            ? b.mode.action === 'attack'
              ? 'Escolha quem atacar (destacados). Esc cancela.'
              : 'Escolha o alvo (destacados). Esc cancela.'
            : 'Jogue cartas, ataque com as que brilham ou passe a vez.');

  return (
    <div className={`battle ${night ? 'is-night' : 'is-day'}`}>
      <div className="battle-main">
        <div className="battle-topbar">
          <button className="btn btn-ghost" onClick={onExit} aria-label="Sair da partida">
            <ArrowLeft {...ICON} /> Banca
          </button>
          <span className="clock">
            {night ? <Moon {...ICON} /> : <Sun {...ICON} />} Rodada {roundOf(state.turn)} · {night ? 'Noite' : 'Dia'}
          </span>
          <TurnTimer key={state.turn} active={myTurn} onTimeout={b.endTurn} />
        </div>

        <HeroBar
          side={1}
          state={state}
          targeted={targets.has('hero-1')}
          floaters={floaters.get('hero-1')}
          eventKey={b.eventKey}
          onClick={() => b.clickHero(1)}
          thinking={b.botThinking}
        />
        <Board
          side={1}
          state={state}
          auras={auras}
          targets={targets}
          floaters={floaters}
          eventKey={b.eventKey}
          onMinion={onMinion}
        />

        <div className="battle-divider">
          <span>{myTurn ? 'Sua vez' : 'Vez do bot'}</span>
        </div>

        <Board
          side={0}
          state={state}
          auras={auras}
          targets={targets}
          floaters={floaters}
          eventKey={b.eventKey}
          onMinion={onMinion}
          placing={b.mode.kind === 'place'}
          onPlace={b.placeAt}
          attackerUid={attackerUid}
          myTurn={myTurn}
        />
        <HeroBar
          side={0}
          state={state}
          targeted={targets.has('hero-0')}
          floaters={floaters.get('hero-0')}
          eventKey={b.eventKey}
          onClick={() => b.clickHero(0)}
          onPower={b.clickPower}
          powerReady={myTurn && !canUsePower(state)}
          powerActive={b.mode.kind === 'target' && b.mode.action === 'power'}
        />

        {me.peek && (
          <p className="peek">
            <Eye {...ICON} /> Carro de som: o bot tem <b>{cardName(me.peek)}</b> na mão.
          </p>
        )}

        <div className="actions">
          <p className="hint" aria-live="polite">
            {hint}
          </p>
          {b.mode.kind !== 'idle' && (
            <button className="btn btn-secondary" onClick={b.cancel}>
              Cancelar
            </button>
          )}
          <button className="btn btn-primary btn-end" disabled={!myTurn} onClick={b.endTurn}>
            Passar a vez
          </button>
          <button className="btn btn-secondary log-toggle" onClick={() => setShowLog((v) => !v)}>
            Log
          </button>
        </div>

        <div className="hand" role="list" aria-label="Sua mão">
          {me.hand.map((c) => {
            const def = getCard(c.defId);
            const playable = myTurn && !canPlay(state, c.uid);
            return (
              <motion.button
                layout
                key={c.uid}
                role="listitem"
                className={`hand-card ${selectedUid === c.uid ? 'is-selected' : ''} ${playable ? 'is-playable' : 'is-expensive'}`}
                onClick={() => b.clickHand(c.uid)}
                aria-pressed={selectedUid === c.uid}
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
              >
                <Card card={def} size="mini" />
              </motion.button>
            );
          })}
        </div>
        {selectedDef && (
          <div className="selected-detail">
            <Card card={selectedDef} size="full" />
          </div>
        )}
      </div>

      <aside className={`battle-log ${showLog ? 'is-open' : ''}`}>
        <h4>O que rolou</h4>
        <LogList events={b.history} />
      </aside>

      {detail && (
        <MinionDialog minion={detail} state={state} auras={auras} onClose={() => setDetail(null)} />
      )}

      {state.winner !== null && (
        <ResultDialog winner={state.winner} onAgain={() => b.start(b.deckIndex)} onExit={onExit} />
      )}
    </div>
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
    <span className={`timer ${left <= 10 && active ? 'is-low' : ''}`} aria-label="Tempo do turno">
      <Timer {...ICON} /> {active ? `${Math.max(0, left)}s` : '…'}
    </span>
  );
}

function Floaters({ items, eventKey }: { items?: { label: string; kind: string; i: number }[]; eventKey: number }) {
  return (
    <AnimatePresence>
      {items?.map(({ label, kind, i }) => (
        <motion.span
          key={`${eventKey}-${i}`}
          className={`floater ${kind}`}
          initial={{ y: 10, opacity: 0, scale: 0.6 }}
          animate={{ y: -18, opacity: [0, 1, 1, 0], scale: 1.2 }}
          transition={{ duration: 1.4, times: [0, 0.15, 0.75, 1] }}
        >
          {label}
        </motion.span>
      ))}
    </AnimatePresence>
  );
}

function HeroBar(props: {
  side: Side;
  state: GameState;
  targeted: boolean;
  floaters?: { label: string; kind: string; i: number }[];
  eventKey: number;
  onClick: () => void;
  onPower?: () => void;
  powerReady?: boolean;
  powerActive?: boolean;
  thinking?: boolean;
}) {
  const { side, state } = props;
  const p = state.players[side];
  const hero = getHero(p.hero.heroId);
  const active = state.active === side && state.winner === null;
  const initials = hero.name
    .split(/\s+/)
    .filter((w) => w.length >= 2)
    .map((w) => w[0])
    .join('');
  return (
    <div className={`herobar herobar-${side === 0 ? 'me' : 'bot'} ${active ? 'is-active' : ''}`}>
      <button
        className={`hero-portrait ${props.targeted ? 'is-target' : ''}`}
        onClick={props.onClick}
        aria-label={`${hero.name}, ${p.hero.hp} de Moral`}
      >
        <span className="hero-initials">{initials}</span>
        <span className="hero-hp">
          <Heart size={12} strokeWidth={3} /> {p.hero.hp}
        </span>
        <Floaters items={props.floaters} eventKey={props.eventKey} />
      </button>
      <div className="hero-info">
        <strong>{hero.name}</strong>
        <span className="hero-meta">
          <span title="Merenda">
            <Sandwich {...ICON} /> {p.merenda}/{p.maxMerenda}
          </span>
          <span title="Mão / deck">
            <Layers {...ICON} /> {p.hand.length}/{p.deck.length}
          </span>
          {props.thinking && <span className="thinking">pensando…</span>}
        </span>
      </div>
      <button
        className={`hero-power ${props.powerReady ? 'is-ready' : ''} ${props.powerActive ? 'is-active' : ''}`}
        onClick={props.onPower}
        disabled={!props.onPower || !props.powerReady}
        title={`${hero.power.name} (${hero.power.cost}): ${hero.power.text}`}
      >
        <span className="hero-power-cost">{hero.power.cost}</span>
        <span className="hero-power-name">{hero.power.name}</span>
        {p.hero.powerUsed && <span className="hero-power-used">usado</span>}
      </button>
    </div>
  );
}

function Board(props: {
  side: Side;
  state: GameState;
  auras: ReturnType<typeof computeAuras>;
  targets: Set<string>;
  floaters: Map<string, { label: string; kind: string; i: number }[]>;
  eventKey: number;
  onMinion: (m: Minion, side: Side) => void;
  placing?: boolean;
  onPlace?: (position: number) => void;
  attackerUid?: string | null;
  myTurn?: boolean;
}) {
  const { side, state } = props;
  const board = state.players[side].board;
  const slot = (i: number) =>
    props.placing ? (
      <button key={`drop-${i}`} className="drop-zone" onClick={() => props.onPlace?.(i)} aria-label={`Colocar na posição ${i + 1}`}>
        <Plus size={16} strokeWidth={3} />
      </button>
    ) : null;
  return (
    <div className={`board board-${side === 0 ? 'me' : 'bot'}`}>
      {board.length === 0 && !props.placing && <span className="board-empty">Mesa vazia</span>}
      {slot(0)}
      <AnimatePresence initial={false}>
        {board.map((m, i) => {
          const def = getCard(m.defId);
          const st = minionStats(m, props.auras);
          const ready = side === 0 && props.myTurn && canAttack(state, m.uid);
          return [
            <motion.button
              layout
              key={m.uid}
              className={`minion ${props.targets.has(m.uid) ? 'is-target' : ''} ${ready ? 'can-attack' : ''} ${
                props.attackerUid === m.uid ? 'is-attacker' : ''
              } ${m.silenced ? 'is-silenced' : ''}`}
              onClick={() => props.onMinion(m, side)}
              initial={{ scale: 0.4, opacity: 0, y: side === 0 ? 30 : -30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.3, opacity: 0, rotate: side === 0 ? -20 : 20 }}
              transition={{ type: 'spring', stiffness: 320, damping: 24 }}
              aria-label={`${def.name}, ${st.power} de Força, ${st.health} de Resistência`}
            >
              <Card card={def} stats={st} size="mini" hideCost shield={m.shield} className={m.shield ? 'has-shield' : ''} />
              <Floaters items={props.floaters.get(m.uid)} eventKey={props.eventKey} />
            </motion.button>,
            slot(i + 1),
          ];
        })}
      </AnimatePresence>
    </div>
  );
}

function MinionDialog({
  minion,
  state,
  auras,
  onClose,
}: {
  minion: Minion;
  state: GameState;
  auras: ReturnType<typeof computeAuras>;
  onClose: () => void;
}) {
  const live = state.players.flatMap((p) => p.board).find((m) => m.uid === minion.uid) ?? minion;
  const st = minionStats(live, auras);
  const def = getCard(live.defId);
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog card-dialog" onClick={(e) => e.stopPropagation()}>
        <Card card={def} stats={st} size="full" />
        {st.keywords.length > 0 && (
          <ul className="kw-list">
            {st.keywords.map((k) => (
              <li key={k}>
                <b>{KEYWORD_INFO[k].name}:</b> {KEYWORD_INFO[k].text}
              </li>
            ))}
          </ul>
        )}
        {live.silenced && <p className="text-muted">Levou Tapa: está sem efeitos.</p>}
        <div className="dialog-actions">
          <button className="btn btn-primary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function LogList({ events }: { events: LogEvent[] }) {
  const items = events.filter((e) => e.type !== 'draw').slice(-120);
  useEffect(() => {
    document.querySelector('.log-end')?.scrollIntoView({ block: 'nearest' });
  }, [items.length]);
  return (
    <ol className="log">
      {items.map((e, i) => (
        <li key={i} className={`log-${e.type} ${'side' in e ? (e.side === 0 ? 'log-me' : 'log-bot') : ''}`}>
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
      ? 'Os dois zeraram juntos. Bafo de respeito.'
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
