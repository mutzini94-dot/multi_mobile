import { fireEvent, render, screen, within } from '@testing-library/react';
import { SlotPickerDialog } from '../../src/ui/SlotPickerDialog';
import { makeChatPage } from '../../src/domain/pages';
import { mkCreator } from '../helpers/fixtures';

function setup() {
  const onPick = vi.fn();
  const onClose = vi.fn();
  render(<SlotPickerDialog layout="quad" slots={[mkCreator(1, { name: '가' }), null, makeChatPage(), null]} name="새방송" onPick={onPick} onClose={onClose} />);
  return { onPick, onClose, dlg: screen.getByRole('dialog', { name: '넣을 창 고르기' }) };
}

test('지금 레이아웃의 창을 번호·현재 내용과 함께 보여 준다', () => {
  const { dlg } = setup();
  expect(within(dlg).getByText(/새방송/)).toBeInTheDocument();
  const buttons = within(dlg).getAllByRole('button', { name: /번 창/ });
  expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(['1번 창 · 가', '2번 창 · 빈 창', '3번 창 · 채팅', '4번 창 · 빈 창']);
  expect(buttons[2].style.gridArea).toBe('1 / 2 / span 1 / span 1');
});

test('창을 누르면 그 창 번호(0부터)로 알린다', () => {
  const { dlg, onPick } = setup();
  fireEvent.click(within(dlg).getByRole('button', { name: '2번 창 · 빈 창' }));
  expect(onPick).toHaveBeenCalledWith(1);
});

test('취소', () => {
  const { dlg, onClose } = setup();
  fireEvent.click(within(dlg).getByRole('button', { name: '취소' }));
  expect(onClose).toHaveBeenCalled();
});
