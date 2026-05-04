import { render } from '@testing-library/react';
import { describe, it } from 'vitest';
import { AdaptivePlayer } from '../../components/video/AdaptivePlayer';

describe('Player Component', () => {
  it('renders correctly with given stream url', () => {
    // Basic test
    render(<AdaptivePlayer src="test.m3u8" token="mock_token" />);
  });
});
