import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router";
import { ref, onValue, query, limitToLast } from "firebase/database";
import { db } from "~/services/firebase/firebase";
import { formatIsoDateToBr } from "~/utils/masks";
import { PrintOrderButton } from "~/components/print-order-button";
import { Search } from "lucide-react";

export function meta() {
  return [{ title: "BigFarma | Histórico de Pedidos" }];
}

export default function History() {
  const [orders, setOrders] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // 1. OTIMIZAÇÃO DE CARREGAMENTO NO FIREBASE
  useEffect(() => {
    setIsLoading(true);
    // Limita a busca aos últimos 150 pedidos para evitar travamentos de memória
    const ordersRef = query(ref(db, "pedidos"), limitToLast(150));

    const unsubscribe = onValue(ordersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));

        // Ordena do mais novo para o mais velho
        setOrders(
          list.sort(
            (a, b) =>
              new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime(),
          ),
        );
      } else {
        setOrders([]);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. OTIMIZAÇÃO DE PESQUISA NA TELA (useMemo)
  const filteredOrders = useMemo(() => {
    if (!searchTerm.trim()) return orders;

    // Normaliza o termo de busca (tudo minúsculo) e tira pontuações para pesquisar CPF/Telefone
    const rawTerm = searchTerm.toLowerCase();
    const numbersOnlyTerm = searchTerm.replace(/\D/g, "");

    return orders.filter((order) => {
      const nome = (order.cliente?.nome || "").toLowerCase();
      const cpf = (order.cliente?.documento || "").replace(/\D/g, "");
      const tel = (order.cliente?.telefone || "").replace(/\D/g, "");

      // Verifica se bate com o nome, ou com os números do CPF/Telefone
      return (
        nome.includes(rawTerm) ||
        (numbersOnlyTerm && cpf.includes(numbersOnlyTerm)) ||
        (numbersOnlyTerm && tel.includes(numbersOnlyTerm))
      );
    });
  }, [orders, searchTerm]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <header className="flex flex-col md:flex-row md:justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Histórico de Exames
            </h1>
            <p className="text-slate-500 text-sm">
              Consulte os últimos 150 pedidos registrados
            </p>
          </div>
          <Link
            to="/home"
            className="text-blue-600 hover:underline font-medium bg-blue-50 px-4 py-2 rounded-lg border border-blue-100 transition-colors"
          >
            ← Voltar para o Caixa
          </Link>
        </header>

        {/* BARRA DE PESQUISA */}
        <div className="mb-6 relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            className="w-full pl-11 pr-4 py-4 rounded-2xl border border-slate-200 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-slate-700 bg-white"
            placeholder="Buscar por paciente, CPF ou número de telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* LISTA DE PEDIDOS */}
        <div className="grid gap-4">
          {isLoading ? (
            <div className="text-center py-20">
              <p className="text-slate-500 font-medium animate-pulse">
                Carregando histórico...
              </p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200">
              <p className="text-slate-400">
                Nenhum pedido encontrado com esses dados.
              </p>
            </div>
          ) : (
            filteredOrders.map((order) => (
              <div
                key={order.id}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-blue-300 transition-colors"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Info do Cliente */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-[10px] font-bold px-2 py-1 bg-blue-50 text-blue-700 rounded-md border border-blue-100">
                        {formatIsoDateToBr(order.criadoEm)}
                      </span>
                      <h2 className="font-bold text-slate-800 uppercase tracking-tight">
                        {order.cliente?.nome || "Sem Nome"}
                      </h2>
                    </div>
                    <p className="text-sm text-slate-500 mt-2">
                      <span className="font-semibold text-slate-400 uppercase text-[10px]">
                        CPF:
                      </span>{" "}
                      {order.cliente?.documento || "-"}
                      <span className="mx-2 text-slate-300">•</span>
                      <span className="font-semibold text-slate-400 uppercase text-[10px]">
                        Tel:
                      </span>{" "}
                      {order.cliente?.telefone || "-"}
                    </p>
                  </div>

                  {/* Totais e Botão */}
                  <div className="flex items-center gap-6 border-t md:border-t-0 pt-4 md:pt-0">
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">
                        Total Pago
                      </p>
                      <p className="text-xl font-black text-blue-900">
                        R$ {order.totais?.totalFinal?.toFixed(2) || "0.00"}
                      </p>
                    </div>
                    <PrintOrderButton order={order} />
                  </div>
                </div>

                {/* Mini lista de exames dentro do card */}
                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-2">
                  {order.itens?.map((item: any, idx: number) => (
                    <span
                      key={idx}
                      className="text-[10px] bg-slate-50 border border-slate-200 text-slate-600 px-2 py-1 rounded font-medium"
                    >
                      {item.qtd}x {item.nome}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
