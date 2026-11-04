import { useCallback, useEffect, useState } from 'react';
import type { Creator } from '../domain/types';
import { filterSignatures, sortSignatures, SIGNATURE_SORTS, type Signature, type SignatureSort } from '../toonation/signatures';

interface Props {
  creator: Creator | null; // 선택한 방송의 크리에이터 (없으면 안내)
  load(tag: string): Promise<Signature[]>;
  onPick?(s: Signature): void; // 누르면 그 시그니처로 후원하기
}

/** 시그니처 칸: 선택한 방송 크리에이터의 시그니처 목록 (검색·정렬) */
export function SignatureView({ creator, load, onPick }: Props) {
  const tag = creator?.donateId ?? '';
  const [list, setList] = useState<Signature[] | null>(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SignatureSort>('popular');

  const fetchList = useCallback(() => {
    if (!tag) return () => {};
    let alive = true;
    setList(null);
    setError(false);
    load(tag).then(
      (r) => alive && setList(r),
      () => alive && setError(true),
    );
    return () => {
      alive = false;
    };
  }, [tag, load]);
  useEffect(() => {
    setQuery(''); // 다른 크리에이터로 바뀌면 검색어는 비운다
    return fetchList();
  }, [fetchList]);

  if (!creator) return <div className="page-view page-view--empty">시그니처를 볼 방송 칸을 선택하세요</div>;
  const shown = list ? sortSignatures(filterSignatures(list, query), sort) : [];
  return (
    <div className="signature">
      <div className="signature__head">
        <strong className="signature__title">{list ? `${creator.name} 시그니처 · ${list.length}개` : `${creator.name} 시그니처`}</strong>
        <div className="signature__tools">
          <input aria-label="시그니처 검색" type="search" value={query} placeholder="이름·금액 검색" onChange={(e) => setQuery(e.target.value)} />
          <select aria-label="시그니처 정렬" value={sort} onChange={(e) => setSort(e.target.value as SignatureSort)}>
            {SIGNATURE_SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error && (
        <p className="form-error">
          시그니처를 불러오지 못했습니다.
          <button type="button" className="btn btn--ghost btn--sm" onClick={fetchList}>
            다시 시도
          </button>
        </p>
      )}
      {!list && !error && <p className="muted">불러오는 중…</p>}
      {list && list.length === 0 && <p className="muted">등록된 시그니처가 없습니다</p>}
      {list && list.length > 0 && shown.length === 0 && <p className="muted">검색 결과가 없습니다</p>}
      {shown.length > 0 && (
        <ul className="signature__grid" aria-label="시그니처 목록">
          {shown.map((s) => (
            <li key={s.hash}>
              <button
                type="button"
                className="signature-card"
                aria-label={`${s.name} · ${s.cash.toLocaleString('ko-KR')}캐시 시그니처로 후원하기`}
                title="이 시그니처로 후원하기"
                onClick={() => onPick?.(s)}
              >
                <span className="signature-card__thumb">{s.image ? <img src={s.image} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span aria-hidden="true">♪</span>}</span>
                <span className="signature-card__name">{s.name}</span>
                <span className="signature-card__cash">{s.cash.toLocaleString('ko-KR')}캐시</span>
                <span className="signature-card__count">{s.count.toLocaleString('ko-KR')}회</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
