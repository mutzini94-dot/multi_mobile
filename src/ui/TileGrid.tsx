import type { ReactNode } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import type { ViewState } from '../domain/types';
import { visibleCount } from '../layout/layouts';

interface Props {
  state: ViewState;
  renderTile(slot: number): ReactNode;
  onSizes(group: string, sizes: number[]): void;
  onDragging?(dragging: boolean): void;
  phone?: boolean; // 휴대폰: 나누기 손잡이 없이 세로로 쌓는다 (app.css .tile-grid--phone)
  tallSlots?: readonly number[]; // 휴대폰: 세로 방송 창은 2배 높이
  hiddenSlots?: readonly number[]; // 휴대폰: 걸러 보기로 숨긴 창 (플레이어는 그대로 둔다)
}

export function TileGrid({ state, renderTile, onSizes, onDragging, phone = false, tallSlots = [], hiddenSlots = [] }: Props) {
  if (phone) {
    // 휴대폰: 모든 창을 같은 크기로 세로 한 줄 (app.css .tile-grid--phone)
    const count = visibleCount(state);
    return (
      <div className={`tile-grid tile-grid--phone tile-grid--${state.layout} tile-grid--n${Math.min(count, 4)}`} key={`phone-${state.layout}`}
        style={{ gridTemplateRows: Array.from({ length: count }, (_, i) => i).filter((i) => !hiddenSlots.includes(i)).map((i) => (tallSlots.includes(i) ? 'minmax(calc(var(--phone-row) * 2), 2fr)' : 'minmax(var(--phone-row), 1fr)')).join(' ') }}
      >
        {Array.from({ length: count }, (_, slot) => (
          <div key={slot} className={`phone-cell${hiddenSlots.includes(slot) ? ' phone-cell--hidden' : ''}`}>
            <div className="panel-inner">{renderTile(slot)}</div>
          </div>
        ))}
      </div>
    );
  }
  // 창 크기 비율은 레이아웃별로 기억한다 (예: 'quad:root')
  const sizeKey = (id: string) => `${state.layout}:${id}`;
  const size = (group: string, i: number, count: number, defaults?: number[]) => state.sizes[sizeKey(group)]?.[i] ?? defaults?.[i] ?? 100 / count;

  // defaults: 처음 비율 (큰 화면 레이아웃은 큰 창을 넓게)
  const group = (id: string, direction: 'horizontal' | 'vertical', children: { node: ReactNode; col?: string }[], defaults?: number[]) => (
    <PanelGroup id={id} direction={direction} onLayout={(s) => onSizes(sizeKey(id), s)}>
      {children.map((c, i) => (
        <PanelChild key={i} index={i} id={id} defaultSize={size(id, i, children.length, defaults)} col={c.col} onDragging={onDragging}>
          {c.node}
        </PanelChild>
      ))}
    </PanelGroup>
  );

  const column = (id: string, col: string, slots: number[]) =>
    slots.length === 1
      ? { node: renderTile(slots[0]), col }
      : { node: group(id, 'vertical', slots.map((s) => ({ node: renderTile(s) }))), col };
  const row = (id: string, slots: number[]) => ({ node: group(id, 'horizontal', slots.map((s) => ({ node: renderTile(s) }))) });

  // 레이아웃별 구성: oneTwo = [왼쪽 위아래 2창 | 오른쪽 1창], quad = [2창 | 2창]
  const key = state.layout;
  let content: ReactNode;
  switch (state.layout) {
    case 'wideSide': // [큰 창 | 오른쪽 좁은 창] (채팅·후원 페이지를 옆에 두기 좋게)
      content = group('root', 'horizontal', [column('col-left', 'left', [0]), column('col-right', 'right', [1])], [72, 28]);
      break;
    case 'single':
      content = group('root', 'horizontal', [{ node: renderTile(0), col: 'left' }]);
      break;
    case 'split2':
      content = group('root', 'horizontal', [column('col-left', 'left', [0]), column('col-right', 'right', [1])]);
      break;
    case 'oneTwo':
      content = group('root', 'horizontal', [column('col-left', 'left', [0, 1]), column('col-right', 'right', [2])]);
      break;
    case 'quad':
      content = group('root', 'horizontal', [column('col-left', 'left', [0, 1]), column('col-right', 'right', [2, 3])]);
      break;
    case 'oneThree': // [큰 창 | 오른쪽 위아래 3창]
      content = group('root', 'horizontal', [column('col-left', 'left', [0]), column('col-right', 'right', [1, 2, 3])], [72, 28]);
      break;
    case 'oneFive': // 위: [큰 창 | 오른쪽 2창], 아래: 3창
      content = group(
        'root',
        'vertical',
        [{ node: group('top', 'horizontal', [column('col-left', 'left', [0]), column('col-right', 'right', [1, 2])], [67, 33]) }, row('bottom', [3, 4, 5])],
        [67, 33],
      );
      break;
    case 'six': // 3열 × 2창 (4분할과 같이 열 순서로 번호)
      content = group('root', 'horizontal', [column('col-1', 'left', [0, 1]), column('col-2', 'mid', [2, 3]), column('col-3', 'right', [4, 5])]);
      break;
    case 'nine':
      content = group('root', 'horizontal', [column('col-1', 'left', [0, 1, 2]), column('col-2', 'mid', [3, 4, 5]), column('col-3', 'right', [6, 7, 8])]);
      break;
  }
  return (
    <div className="tile-grid" key={key}>
      {content}
    </div>
  );
}

function PanelChild({
  index,
  id,
  defaultSize,
  col,
  onDragging,
  children,
}: {
  index: number;
  id: string;
  defaultSize: number;
  col?: string;
  onDragging?(dragging: boolean): void;
  children: ReactNode;
}) {
  return (
    <>
      {index > 0 && <PanelResizeHandle className="resize-handle" onDragging={onDragging} />}
      <Panel id={`${id}-${index}`} order={index} defaultSize={defaultSize} minSize={15}>
        <div className="panel-inner" data-col={col}>
          {children}
        </div>
      </Panel>
    </>
  );
}
