import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { ref, onValue, set, push } from "firebase/database";
import { db } from "~/services/firebase/firebase";
import { Input } from "~/components/input";
import { Button } from "~/components/button";
import type { CartItem, ClientData, Exam } from "~/types/types";
import { AdminPanel } from "~/components/admin-panel";
import { formatCpf, formatPhone } from "~/utils/masks";
import { OrderPDF } from "~/components/order-pdf";
import { pdf } from "@react-pdf/renderer";
export function meta() {
  return [
    { title: "BigFarma | Painel de Atendimento" },
    { name: "description", content: "Sistema integrado de pedidos e exames." },
  ];
}
export default function Home() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  // Estados de Dados
  const [examsDB, setExamsDB] = useState<Exam[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [totalDiscountPct, setTotalDiscountPct] = useState(0);

  // Estados de Input
  const [client, setClient] = useState<ClientData>({
    nome: "",
    documento: "",
    telefone: "",
    dataNascimento: "",
    dataPedido: new Date().toISOString().slice(0, 10),
    observacoes: "",
  });

  const [selectedExamText, setSelectedExamText] = useState("");
  const [selectedExamPrice, setSelectedExamPrice] = useState("");
  const [itemQty, setItemQty] = useState("1");
  const [itemDiscount, setItemDiscount] = useState("0");

  // 1. Efeito para checar Permissão e Buscar Exames em Tempo Real
  useEffect(() => {
    const role = localStorage.getItem("@BigFarma:userRole");
    setIsAdmin(role === "admin");

    const examsRef = ref(db, "exames");
    const unsubscribe = onValue(examsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const loadedExams = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));
        setExamsDB(loadedExams);
      }
    });

    return () => unsubscribe(); // Limpa o listener ao sair da tela
  }, []);

  // 2. Lógica de Autopreencher preço ao digitar
  useEffect(() => {
    const examFound = examsDB.find(
      (e) =>
        e.nome.toLowerCase() === selectedExamText.toLowerCase() ||
        `${e.codigo} - ${e.nome}` === selectedExamText,
    );
    if (examFound) {
      setSelectedExamPrice(examFound.preco.toString());
    } else {
      setSelectedExamPrice("");
    }
  }, [selectedExamText, examsDB]);

  // 3. Adicionar ao Carrinho
  const handleAddToCart = () => {
    const examFound = examsDB.find(
      (e) =>
        e.nome.toLowerCase() === selectedExamText.toLowerCase() ||
        `${e.codigo} - ${e.nome}` === selectedExamText,
    );

    if (!examFound) return alert("Exame não encontrado no banco.");
    if (Number(itemQty) <= 0) return alert("Quantidade inválida.");

    const newItem: CartItem = {
      ...examFound,
      qtd: Number(itemQty),
      descontoPct: Number(itemDiscount),
    };

    setCart((prev) => {
      const existing = prev.find((i) => i.id === newItem.id);
      if (existing) {
        return prev.map((i) =>
          i.id === newItem.id
            ? {
                ...i,
                qtd: i.qtd + newItem.qtd,
                descontoPct: newItem.descontoPct,
              }
            : i,
        );
      }
      return [...prev, newItem];
    });

    // Reseta form do item
    setSelectedExamText("");
    setItemQty("1");
    setItemDiscount("0");
  };
  const handleSaveAndPrint = async () => {
    if (cart.length === 0) return alert("O carrinho está vazio.");
    if (!client.nome || !client.telefone)
      return alert("Nome e telefone são obrigatórios.");

    setIsProcessing(true);

    try {
      const ordersRef = ref(db, "pedidos");
      const newOrderRef = push(ordersRef);
      const orderId = newOrderRef.key;

      const orderData = {
        id: orderId,
        cliente: client,
        itens: cart,
        totais: {
          descontoGeralPct: totalDiscountPct,
          totalItens: totalWithItems,
          totalFinal: finalTotal,
        },
        criadoEm: new Date().toISOString(),
        status: "concluido",
      };

      await set(newOrderRef, orderData);

      const doc = <OrderPDF order={orderData} />;
      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);

      const printWindow = window.open(url);
      if (printWindow) {
        printWindow.addEventListener("load", () => {
          printWindow.print();
        });
      }

      alert("Pedido salvo e enviado para impressão!");

      setCart([]);
      setClient({
        nome: "",
        documento: "",
        telefone: "",
        dataNascimento: "",
        dataPedido: new Date().toISOString().slice(0, 10),
        observacoes: "",
      });
      setTotalDiscountPct(0);
    } catch (error) {
      console.error(error);
      alert("Erro ao processar pedido.");
    } finally {
      setIsProcessing(false);
    }
  };
  const removeFromCart = (id: string) =>
    setCart(cart.filter((item) => item.id !== id));

  // 4. Cálculos
  const totalWithItems = cart.reduce((acc, item) => {
    const subtotal = item.preco * item.qtd;
    return acc + subtotal * (1 - item.descontoPct / 100);
  }, 0);

  const finalTotal = totalWithItems * (1 - totalDiscountPct / 100);

  const handleLogout = () => {
    localStorage.removeItem("@BigFarma:userRole");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* HEADER */}
        <header className="bg-blue-900 text-white p-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">BigFarma</h1>
            <p className="text-blue-200">Sistema integrado de Pedidos</p>
          </div>
          <div className="flex gap-4 items-center">
            {/* Botão para ir para o Histórico */}
            <Link
              to="/history"
              className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-white font-semibold transition-colors"
            >
              Ver Histórico
            </Link>
            <button
              onClick={handleLogout}
              className="text-red-300 hover:text-red-100 font-bold ml-4"
            >
              Sair
            </button>
          </div>
        </header>

        <div className="p-6 md:p-10">
          {isAdmin && <AdminPanel />}

          {/* SESSÃO 1: CLIENTE */}
          <section className="mb-10">
            <h2 className="text-xl font-bold border-b-2 border-gray-200 pb-2 mb-6">
              1. Informações do Paciente
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Nome Completo
                </label>
                <Input
                  value={client.nome}
                  onChange={(e) =>
                    setClient({ ...client, nome: e.target.value })
                  }
                  placeholder="Ex: João da Silva"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">CPF</label>
                <Input
                  value={client.documento}
                  onChange={(e) =>
                    setClient({
                      ...client,
                      documento: formatCpf(e.target.value),
                    })
                  }
                  placeholder="000.000.000-00"
                  maxLength={14}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Data de Nascimento
                </label>
                <Input
                  type="date"
                  value={client.dataNascimento}
                  onChange={(e) =>
                    setClient({ ...client, dataNascimento: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Telefone / WhatsApp
                </label>
                <Input
                  value={client.telefone}
                  onChange={(e) =>
                    setClient({
                      ...client,
                      telefone: formatPhone(e.target.value),
                    })
                  }
                  placeholder="(99) 99999-9999"
                  maxLength={15}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Data do Pedido
                </label>
                <Input
                  type="date"
                  value={client.dataPedido}
                  onChange={(e) =>
                    setClient({ ...client, dataPedido: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="mt-2">
              <label className="block text-sm font-semibold mb-1">
                Observações
              </label>
              <textarea
                className="w-full rounded-lg p-4 border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                rows={3}
                value={client.observacoes}
                onChange={(e) =>
                  setClient({ ...client, observacoes: e.target.value })
                }
              />
            </div>
          </section>

          {/* SESSÃO 2: ADICIONAR EXAMES */}
          <section className="mb-10 bg-gray-50 p-6 rounded-xl border border-gray-200">
            <h2 className="text-xl font-bold mb-4">
              2. Adicionar Exame ao Carrinho
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold mb-1">
                  Buscar Exame
                </label>
                <input
                  list="exams-list"
                  className="w-full h-12.5 rounded-lg px-4 border border-gray-300 bg-white"
                  value={selectedExamText}
                  onChange={(e) => setSelectedExamText(e.target.value)}
                  placeholder="Digite o nome..."
                />
                <datalist id="exams-list">
                  {examsDB.map((e) => (
                    <option key={e.id} value={`${e.codigo} - ${e.nome}`} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Valor
                </label>
                <Input
                  readOnly
                  value={selectedExamPrice}
                  placeholder="R$ 0,00"
                  className="bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Qtd</label>
                <Input
                  type="number"
                  min="1"
                  value={itemQty}
                  onChange={(e) => setItemQty(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Desc. Item (%)
                </label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={itemDiscount}
                  onChange={(e) => setItemDiscount(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-4 md:w-1/4">
              <Button onClick={handleAddToCart}>Adicionar Exame</Button>
            </div>
          </section>

          {/* SESSÃO 3: CARRINHO E TOTAIS */}
          <section>
            <div className="flex justify-between items-center border-b-2 border-gray-200 pb-2 mb-6">
              <h2 className="text-xl font-bold">3. Exames Selecionados</h2>
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold">
                  Desconto Geral (%):
                </label>
                <input
                  type="number"
                  className="w-20 p-2 border rounded"
                  value={totalDiscountPct}
                  onChange={(e) => setTotalDiscountPct(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-gray-700">
                    <th className="p-3 border-b">Cód.</th>
                    <th className="p-3 border-b">Exame</th>
                    <th className="p-3 border-b text-right">Valor</th>
                    <th className="p-3 border-b text-center">Qtd</th>
                    <th className="p-3 border-b text-center">Desc.%</th>
                    <th className="p-3 border-b text-right">Subtotal</th>
                    <th className="p-3 border-b text-center">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-gray-500">
                        Nenhum exame selecionado.
                      </td>
                    </tr>
                  ) : (
                    cart.map((item) => (
                      <tr key={item.id} className="border-b hover:bg-gray-50">
                        <td className="p-3">{item.codigo}</td>
                        <td className="p-3">{item.nome}</td>
                        <td className="p-3 text-right">
                          R$ {item.preco.toFixed(2)}
                        </td>
                        <td className="p-3 text-center">{item.qtd}</td>
                        <td className="p-3 text-center">{item.descontoPct}%</td>
                        <td className="p-3 text-right font-semibold">
                          R${" "}
                          {(
                            item.preco *
                            item.qtd *
                            (1 - item.descontoPct / 100)
                          ).toFixed(2)}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="text-red-500 hover:text-red-700 font-semibold text-sm"
                          >
                            Remover
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* TOTAIS */}
            <div className="flex flex-col items-end mt-6 space-y-2">
              <p className="text-gray-600">
                Total (c/ desc. itens):{" "}
                <span className="font-bold text-lg text-black">
                  R$ {totalWithItems.toFixed(2)}
                </span>
              </p>
              <p className="text-xl text-blue-900 font-bold">
                TOTAL FINAL: R$ {finalTotal.toFixed(2)}
              </p>
            </div>
            {/* BOTÕES FINAIS */}
            <div className="flex justify-end gap-4 mt-8 pt-6 border-t-2 border-gray-200">
              <button
                onClick={() => {
                  setCart([]);
                  alert("Carrinho limpo");
                }}
                className="px-6 py-3 rounded-lg font-bold text-red-600 bg-red-50 hover:bg-red-100"
              >
                Limpar Carrinho
              </button>

              <Button
                onClick={handleSaveAndPrint}
                isLoading={isProcessing}
                className="bg-green-600 hover:bg-green-700 h-16 px-12 text-xl shadow-lg shadow-green-100 rounded-2xl transition-all active:scale-95"
              >
                Salvar e Imprimir
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
