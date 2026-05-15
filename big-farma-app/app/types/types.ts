export interface Exam {
  id: string;
  codigo: string;
  nome: string;
  preco: number;
}

export interface CartItem extends Exam {
  qtd: number;
  descontoPct: number;
}

export interface ClientData {
  nome: string;
  documento: string;
  telefone: string;
  dataNascimento: string;
  dataPedido: string;
  observacoes: string;
}
export interface Order {
  id: string;
  cliente: ClientData;
  itens: CartItem[];
  totais: {
    totalFinal: number;
  };
  criadoEm: string;
}
