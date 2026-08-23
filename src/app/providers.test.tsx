import { useQuery } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Providers } from './providers';

function QueryProbe() {
  const { data } = useQuery({ queryKey: ['probe'], queryFn: () => '연결됨' });
  return <span>{data ?? '로딩 중'}</span>;
}

describe('Providers', () => {
  it('QueryClientProvider를 붙여 하위에서 useQuery를 쓸 수 있게 한다', async () => {
    render(
      <Providers>
        <QueryProbe />
      </Providers>,
    );

    expect(screen.getByText('로딩 중')).toBeInTheDocument();
    expect(await screen.findByText('연결됨')).toBeInTheDocument();
  });
});
