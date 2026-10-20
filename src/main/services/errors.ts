/** Erro de regra de negócio, com mensagem segura para ser exibida ao usuário. */
export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly field?: string,
  ) {
    super(message)
    this.name = 'DomainError'
  }
}
