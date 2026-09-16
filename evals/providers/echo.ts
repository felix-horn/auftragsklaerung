import type { ApiProvider, ProviderResponse } from 'promptfoo';

export default class EchoProvider implements ApiProvider {
  id = () => 'echo';

  async callApi(prompt: string): Promise<ProviderResponse> {
    return { output: prompt.toUpperCase() };
  }
}