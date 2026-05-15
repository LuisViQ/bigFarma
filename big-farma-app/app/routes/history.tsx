import { useState, useEffect } from "react";
import { Link } from "react-router";
import { ref, onValue } from "firebase/database";
import { db } from "~/services/firebase/firebase";
import { formatIsoDateToBr } from "~/utils/masks";
import { PrintOrderButton } from "~/components/print-order-button";

export default function History() {
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    const ordersRef = ref(db, "pedidos");
    return onValue(ordersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));
        setOrders(
          list.sort(
            (a, b) =>
              new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime(),
          ),
        );
      }
    });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Histórico de Exames
            </h1>
            <p className="text-slate-500 text-sm">
              Consulte e reimprima pedidos antigos
            </p>
          </div>
          <Link
            to="/home"
            className="text-blue-600 hover:underline font-medium"
          >
            ← Voltar para o Caixa
          </Link>
        </header>

        <div className="grid gap-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-blue-300 transition-colors"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Info do Cliente */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-xs font-bold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                      {formatIsoDateToBr(order.criadoEm)}
                    </span>
                    <h2 className="font-bold text-slate-800 uppercase tracking-tight">
                      {order.cliente.nome}
                    </h2>
                  </div>
                  <p className="text-sm text-slate-500">
                    CPF: {order.cliente.documento} • Tel:{" "}
                    {order.cliente.telefone}
                  </p>
                </div>

                {/* Totais e Botão */}
                <div className="flex items-center gap-6 border-t md:border-t-0 pt-3 md:pt-0">
                  <div className="text-right">
                    <p className="text-xs text-slate-400 uppercase font-bold">
                      Total
                    </p>
                    <p className="text-lg font-black text-slate-900">
                      R$ {order.totais.totalFinal.toFixed(2)}
                    </p>
                  </div>
                  <PrintOrderButton order={order} />
                </div>
              </div>

              {/* Mini lista de exames dentro do card */}
              <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-2">
                {order.itens.map((item: any, idx: number) => (
                  <span
                    key={idx}
                    className="text-[10px] bg-slate-50 border border-slate-200 text-slate-600 px-2 py-1 rounded"
                  >
                    {item.qtd}x {item.nome}
                  </span>
                ))}
              </div>
            </div>
          ))}

          {orders.length === 0 && (
            <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200">
              <p className="text-slate-400">
                Nenhum exame encontrado no histórico.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
