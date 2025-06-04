sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/VBox",
    "sap/m/HBox",
    "sap/m/Text",
    "sap/m/Title",
    "sap/m/Button",
    "sap/m/ObjectNumber",
    "sap/m/MessageStrip",
  ],
  function (
    Controller,
    MessageToast,
    VBox,
    HBox,
    Text,
    Title,
    Button,
    ObjectNumber,
    MessageStrip
  ) {
    "use strict";

    return Controller.extend("ui5.walkthrough.controller.App", {
      onInit: function () {
        this._clients = [];
        this._clientsContainer = this.byId("clients-container");
        this._clientCountElement = this.byId("client-count");
        this._summaryTable = this.byId("summaryTable");
      },

      onChange: function () {
        var oFileUploader = this.byId("fileUploader");
        var oFile = oFileUploader.getDomRef("fu")?.files[0];

        if (!oFile) {
          sap.m.MessageToast.show("Please upload a PDF file.");
          return;
        }

        if (oFile.type !== "application/pdf") {
          sap.m.MessageToast.show("Only PDF files are allowed.");
          return;
        }

        sap.m.MessageToast.show("PDF uploaded successfully!");

        this._renderPdfToImage(oFile);
      },

      _renderPdfToImage: async function (file) {
        const reader = new FileReader();

        reader.onload = async () => {
          // ✅ arrow function to preserve "this"
          try {
            const typedarray = new Uint8Array(reader.result);
            const pdf = await pdfjsLib.getDocument({ data: typedarray })
              .promise;
            const page = await pdf.getPage(1);

            const scale = 1.5;
            const viewport = page.getViewport({ scale });

            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");

            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = {
              canvasContext: context,
              viewport: viewport,
            };

            await page.render(renderContext).promise;

            const dataUrl = canvas.toDataURL("image/png");

            if (dataUrl && dataUrl.startsWith("data:image/png")) {
              const base64String = dataUrl.split(",")[1];
              sap.m.MessageToast.show(
                "✅ Image generated and converted to Base64."
              );
              this._sendToCloudVision(base64String); // ✅ now works correctly
            } else {
              sap.m.MessageToast.show("❌ Failed to generate image.");
            }
          } catch (err) {
            console.error("Error rendering PDF to image:", err);
            sap.m.MessageToast.show("Error rendering PDF to image.");
          }
        };

        reader.readAsArrayBuffer(file);
      },

      _sendToCloudVision: async function (base64String) {
        const apiKey = ""; // <-- insira sua chave aqui

        const body = {
          requests: [
            {
              image: {
                content: base64String,
              },
              features: [
                {
                  type: "DOCUMENT_TEXT_DETECTION",
                },
              ],
            },
          ],
        };

        try {
          const response = await fetch(
            `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(body),
            }
          );

          const result = await response.json();

          const fullText = result.responses?.[0]?.fullTextAnnotation?.text;

          if (fullText) {
            sap.m.MessageToast.show("📄 Text detected successfully!");

            // Tenta extrair o código de booking
            const match = fullText.match(/Nr\.? Booking:\s*(\w+)/i);

            if (match && match[1]) {
              const bookingCode = match[1];
              console.log("Booking code:", bookingCode);

              // Define o valor no campo inputCliente
              const oInput = this.byId("inputCliente");
              if (oInput) {
                oInput.setValue(bookingCode);
                sap.m.MessageToast.show("✅ Booking code set: " + bookingCode);
              } else {
                console.warn("inputCliente not found.");
              }
            } else {
              sap.m.MessageToast.show("❌ 'Nr. Booking' not found.");
            }

            // Tenta extrair o valor antes de "Kgs"
            const pesoMatch = fullText.match(/([\d.,]+)\s*Kgs/i);

            if (pesoMatch && pesoMatch[1]) {
              const quantidade = pesoMatch[1]
                .replace(/\./g, "")
                .replace(",", "."); // normaliza para número
              console.log("Quantidade extraída:", quantidade);

              const oInputQtd = this.byId("inputQuantidade");
              if (oInputQtd) {
                oInputQtd.setValue(quantidade);
                sap.m.MessageToast.show("✅ Quantidade setada: " + quantidade);
              } else {
                console.warn("inputQuantidade not found.");
              }
            } else {
              sap.m.MessageToast.show("❌ Quantidade (Kgs) não encontrada.");
            }
          } else {
            sap.m.MessageToast.show("No text found.");
          }
        } catch (error) {
          console.error("Error calling Cloud Vision API:", error);
          sap.m.MessageToast.show("❌ Cloud Vision request failed.");
        }
      },

      onRegisterClient: function () {
        const oView = this.getView();

        const name = oView.byId("inputCliente").getValue();
        const minPrice =
          parseFloat(oView.byId("inputPrecoMin").getValue()) || 0;
        const quantity =
          parseFloat(oView.byId("inputQuantidade").getValue()) || 0;
        const negotiatedPrice =
          parseFloat(oView.byId("inputPrecoNegociado").getValue()) || 0;
        const discountPercent =
          parseFloat(oView.byId("inputDescontoPerc").getValue()) || 0;
        const discountAmount =
          parseFloat(oView.byId("inputDescontoUsd").getValue()) || 0;

        const afterPercentDiscount =
          negotiatedPrice * (1 - discountPercent / 100);
        const afterAmountDiscount = Math.max(
          0,
          afterPercentDiscount - discountAmount
        );
        const netValue = afterAmountDiscount * quantity;

        const client = {
          id: Date.now(),
          name,
          minPrice,
          quantity,
          negotiatedPrice,
          discountPercent,
          discountAmount,
          afterPercentDiscount,
          afterAmountDiscount,
          netValue,
        };

        this._clients.push(client);
        this.updateClientsDisplay();

        MessageToast.show(`Cliente registrado: ${name}`);
      },

      deleteClient: function (id) {
        this._clients = this._clients.filter((c) => c.id !== id);
        this.updateClientsDisplay();
      },

      updateClientsDisplay: function () {
        const container = this._clientsContainer;
        container.removeAllItems();

        if (this._clients.length === 0) {
          container.addItem(
            new VBox({
              alignItems: "Center",
              justifyContent: "Center",
              class:
                "sapUiMediumMarginTop sapUiContentPadding sapUiTinyMarginBottom",
              items: [
                new Text({
                  text: "Nenhum cliente registrado",
                  class: "sapUiTinyMarginBottom",
                }),
                new Text({
                  text: "Adicione o primeiro cliente através do formulário",
                  design: "Small",
                }),
              ],
            })
          );
        } else {
          this._clients.forEach((client) => {
            const warningVisible = client.afterAmountDiscount < client.minPrice;

            const leftColumn = new VBox({
              items: [
                new HBox({
                  justifyContent: "SpaceBetween",
                  items: [
                    new Text({ text: "Minimum Price:", design: "Bold" }),
                    new Text({
                      text: `$${client.minPrice.toFixed(2)}/ton`,
                      design: "Bold",
                    }),
                  ],
                }),
                new HBox({
                  justifyContent: "SpaceBetween",
                  items: [
                    new Text({ text: "Quantity:", design: "Bold" }),
                    new Text({
                      text: `${client.quantity.toFixed(2)} tons`,
                      design: "Bold",
                    }),
                  ],
                }),
                new HBox({
                  justifyContent: "SpaceBetween",
                  items: [
                    new Text({ text: "Negotiated Price:", design: "Bold" }),
                    new Text({
                      text: `$${client.negotiatedPrice.toFixed(2)}/ton`,
                      design: "Bold",
                    }),
                  ],
                }),
                new HBox({
                  justifyContent: "SpaceBetween",
                  items: [
                    new Text({ text: "Discount (%):", design: "Bold" }),
                    new Text({
                      text: `${client.discountPercent.toFixed(2)}%`,
                      design: "Bold",
                    }),
                  ],
                }),
                new HBox({
                  justifyContent: "SpaceBetween",
                  items: [
                    new Text({ text: "Discount (USD):", design: "Bold" }),
                    new Text({
                      text: `$${client.discountAmount.toFixed(2)}/ton`,
                      design: "Bold",
                    }),
                  ],
                }),
              ],
            });

            const rightColumn = new VBox({
              items: [
                new HBox({
                  justifyContent: "SpaceBetween",
                  items: [
                    new Text({ text: "Negotiated Price:", design: "Bold" }),
                    new Text({
                      text: `$${client.negotiatedPrice.toFixed(2)}/ton`,
                      design: "Bold",
                    }),
                  ],
                }),
                new HBox({
                  justifyContent: "SpaceBetween",
                  items: [
                    new Text({
                      text: `After ${client.discountPercent}% Discount:`,
                      design: "Bold",
                    }),
                    new Text({
                      text: `$${client.afterPercentDiscount.toFixed(2)}/ton`,
                      design: "Bold",
                    }),
                  ],
                }),
                new HBox({
                  justifyContent: "SpaceBetween",
                  items: [
                    new Text({
                      text: `After $${client.discountAmount.toFixed(
                        2
                      )} Discount:`,
                      design: "Bold",
                    }),
                    new Text({
                      text: `$${client.afterAmountDiscount.toFixed(2)}/ton`,
                      design: "Bold",
                    }),
                  ],
                }),
                new HBox({
                  justifyContent: "SpaceBetween",
                  items: [
                    new Text({ text: "Quantity:", design: "Bold" }),
                    new Text({
                      text: `${client.quantity.toFixed(2)} tons`,
                      design: "Bold",
                    }),
                  ],
                }),
              ],
            });

            const columns = new HBox({
              justifyContent: "SpaceBetween",
              class: "sapUiSmallMarginTop sapUiSmallMarginBottom",
              items: [leftColumn, rightColumn],
            });

            const netValueBox = new HBox({
              alignItems: "Center",
              class: "sapUiSmallMarginTop sapUiSmallMarginBottom",
              style:
                "background-color: #eef5ff; border-radius: 8px; padding: 1rem;",
              items: [
                new Text({
                  text: "Net Value: ",
                  class: "sapUiSmallMarginEnd",
                  design: "Bold",
                }),
                new ObjectNumber({
                  number: client.netValue.toFixed(2),
                  unit: "USD",
                  emphasized: true,
                  class: "sapUiLargeMarginBegin",
                }),
              ],
            });

            const card = new VBox({
              class: "sapUiContentPadding sapUiSmallMarginBottom",
              style:
                "border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.1); border: 1px solid #e0e0e0;",
              items: [
                new HBox({
                  justifyContent: "SpaceBetween",
                  alignItems: "Center",
                  items: [
                    new Title({ text: client.name, level: "H3" }),
                    new Button({
                      icon: "sap-icon://delete",
                      type: "Transparent",
                      press: () => this.deleteClient(client.id),
                    }),
                  ],
                }),
                columns,
                netValueBox,
                warningVisible
                  ? new MessageStrip({
                      text: "Final price per ton is below minimum price, but this is acceptable after discounts.",
                      type: "Warning",
                      showIcon: true,
                    })
                  : null,
              ].filter(Boolean),
            });

            container.addItem(card);
          });
        }

        this._clientCountElement.setText(
          `${this._clients.length} client${
            this._clients.length !== 1 ? "s" : ""
          }`
        );

        // Update the summary table as well:
        this.updateSummaryTable();
      },

      updateSummaryTable: function () {
        const oTable = this._summaryTable;
        oTable.removeAllItems();

        if (this._clients.length === 0) {
          // Table noDataText will show automatically
          return;
        }

        this._clients.forEach((client) => {
          const oItem = new sap.m.ColumnListItem({
            cells: [
              new sap.m.Text({ text: client.name }),
              new sap.m.Text({ text: `$${client.minPrice.toFixed(2)}` }),
              new sap.m.Text({ text: client.quantity.toFixed(2) }),
              new sap.m.Text({ text: `$${client.negotiatedPrice.toFixed(2)}` }),
              new sap.m.Text({
                text: `${client.discountPercent.toFixed(
                  2
                )}% + $${client.discountAmount.toFixed(2)}`,
              }),
              new sap.m.Text({ text: `$${client.netValue.toFixed(2)}` }),
            ],
          });
          oTable.addItem(oItem);
        });
      },
    });
  }
);
