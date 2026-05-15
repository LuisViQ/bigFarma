import {
  Page,
  Text,
  View,
  Document,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { Order } from "~/types/types";
import { formatIsoDateToBr } from "~/utils/masks";

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 10, fontFamily: "Helvetica" },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: "#1e3a8a",
    paddingBottom: 10,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1e3a8a",
    textAlign: "center",
  },
  sectionTitle: {
    backgroundColor: "#f3f4f6",
    padding: 5,
    fontWeight: "bold",
    marginTop: 15,
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#1e3a8a",
    color: "white",
    padding: 5,
    fontWeight: "bold",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    padding: 5,
  },
  col1: { width: "15%" },
  col2: { width: "50%" },
  col3: { width: "10%", textAlign: "center" },
  col4: { width: "25%", textAlign: "right" },
  footer: {
    marginTop: 50,
    textAlign: "center",
    fontSize: 8,
    color: "#999",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 10,
  },
});

export const OrderPDF = ({ order }: { order: Order }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>BigFarma</Text>
        <Text style={{ textAlign: "center", color: "#666" }}>
          Laboratório de Análises Clínicas
        </Text>
      </View>

      <Text style={styles.sectionTitle}>DADOS DO PACIENTE</Text>
      <View style={styles.row}>
        <Text>Paciente: {order.cliente.nome}</Text>
        <Text>CPF: {order.cliente.documento}</Text>
      </View>
      <View style={styles.row}>
        <Text>Data: {formatIsoDateToBr(order.criadoEm)}</Text>
        <Text>Tel: {order.cliente.telefone}</Text>
      </View>

      <Text style={styles.sectionTitle}>EXAMES SOLICITADOS</Text>
      <View style={styles.tableHeader}>
        <Text style={styles.col1}>Cód.</Text>
        <Text style={styles.col2}>Exame</Text>
        <Text style={styles.col3}>Qtd</Text>
        <Text style={styles.col4}>Valor</Text>
      </View>
      {order.itens.map((item, i) => (
        <View key={i} style={styles.tableRow}>
          <Text style={styles.col1}>{item.codigo}</Text>
          <Text style={styles.col2}>{item.nome}</Text>
          <Text style={styles.col3}>{item.qtd}</Text>
          <Text style={styles.col4}>R$ {item.preco.toFixed(2)}</Text>
        </View>
      ))}

      <View style={{ marginTop: 20, alignItems: "flex-end" }}>
        <Text style={{ fontSize: 14, fontWeight: "bold", color: "#1e3a8a" }}>
          Total Final: R$ {order.totais.totalFinal.toFixed(2)}
        </Text>
      </View>

      <Text style={styles.footer}>
        Comprovante gerado em {new Date().toLocaleString("pt-BR")}
      </Text>
    </Page>
  </Document>
);
