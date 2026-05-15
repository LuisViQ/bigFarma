import { PDFDownloadLink } from "@react-pdf/renderer";
import { OrderPDF } from "../order-pdf/index";
import { FileText } from "lucide-react";

export function PrintOrderButton({ order }: { order: any }) {
  return (
    <PDFDownloadLink
      document={<OrderPDF order={order} />}
      fileName={`Pedido_${order.cliente.nome.replace(/\s+/g, "_")}.pdf`}
    >
      {({ loading }) => (
        <button
          disabled={loading}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all
            ${
              loading
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md active:scale-95"
            }
          `}
        >
          <FileText size={18} />
          {loading ? "Processando..." : "Gerar PDF"}
        </button>
      )}
    </PDFDownloadLink>
  );
}
