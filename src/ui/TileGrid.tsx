import type { ReactNode } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import type { ViewState } from '../domain/types';

interface Props {
  state: ViewState;
  renderTile(slot: number): ReactNode;
  onSizes(group: string, sizes: number[]): void;
}

export function TileGrid({ state, renderTile, onSizes }: Props) {
  const size = (group: string, i: number, count: number) => state.sizes[group]?.[i] ?? 100 / count;

  const group = (id: string, direction: 'horizontal' | 'vertical', children: { node: ReactNode; col?: string }[]) => (
    <PanelGroup id={id} direction={direction} onLayout={(s) => onSizes(id, s)}>
      {children.map((c, i) => (
        <PanelChild key={i} index={i} id={id} defaultSize={size(id, i, children.length)} col={c.col}>
          {c.node}
        </PanelChild>
      ))}
    </PanelGroup>
  );

  const column = (id: string, col: string, slots: number[]) =>
    slots.length === 1
      ? { node: renderTile(slots[0]), col }
      : { node: group(id, 'vertical', slots.map((s) => ({ node: renderTile(s) }))), col };

  // 레이아웃별 구성: oneTwo = [왼쪽 위아래 2칸 | 오른쪽 1칸], quad = [2칸 | 2칸]
  const key = state.layout;
  let content: ReactNode;
  switch (state.layout) {
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
  }
  return (
    <div className="tile-grid" key={key}>
      {content}
    </div>
  );
}

function PanelChild({ index, id, defaultSize, col, children }: { index: number; id: string; defaultSize: number; col?: string; children: ReactNode }) {
  return (
    <>
      {index > 0 && <PanelResizeHandle className="resize-handle" />}
      <Panel id={`${id}-${index}`} order={index} defaultSize={defaultSize} minSize={15}>
        <div className="panel-inner" data-col={col}>
          {children}
        </div>
      </Panel>
    </>
  );
}
