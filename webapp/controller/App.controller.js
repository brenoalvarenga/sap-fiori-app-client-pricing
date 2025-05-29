sap.ui.define(
  ["sap/ui/core/mvc/Controller", "sap/m/MessageToast"],
  (Controller, MessageToast) => {
    "use strict";

    return Controller.extend("ui5.walkthrough.controller.App", {
      onRegisterClient: function () {
        // Get the view (the current XML view)
        const oView = this.getView();

        // Retrieve inputs by their IDs
        const sCliente = oView.byId("inputCliente").getValue();
        const sPrecoMin = oView.byId("inputPrecoMin").getValue();
        const sQuantidade = oView.byId("inputQuantidade").getValue();
        const sPrecoNegociado = oView.byId("inputPrecoNegociado").getValue();
        const sDescontoPerc = oView.byId("inputDescontoPerc").getValue();
        const sDescontoUsd = oView.byId("inputDescontoUsd").getValue();

        // Compose a display message with the values
        const sMessage =
          `Cliente: ${sCliente}\n` +
          `Preço mínimo (USD/ton): ${sPrecoMin}\n` +
          `Quantidade (tons): ${sQuantidade}\n` +
          `Preço negociado (USD/ton): ${sPrecoNegociado}\n` +
          `Desconto (%): ${sDescontoPerc}\n` +
          `Desconto (USD/ton): ${sDescontoUsd}`;

        // Show the message toast with collected input values
        MessageToast.show(sMessage);
      },
    });
  }
);
