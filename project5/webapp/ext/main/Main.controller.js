sap.ui.define(
    [
        'sap/fe/core/PageController',
        "sap/m/MessageToast",
        "sap/ui/core/UIComponent",
        "sap/ui/model/Filter",
        "sap/ui/model/FilterOperator",
        "sap/ui/core/Fragment",
        "sap/ui/model/json/JSONModel"
    ],
    function (PageController, MessageToast, UIComponent, Filter, FilterOperator, Fragment, JSONModel) {
        'use strict';

        return PageController.extend('project5.ext.main.Main', {

            onCreateJob: function (oEvent) {

                var oExtensionAPI = this.getExtensionAPI();

                if (oExtensionAPI && oExtensionAPI.routing) {
                    oExtensionAPI.routing.navigateToRoute("CreateJobRoute");
                } else {
                    console.error("ExtensionAPI routing is not available.");
                }
            },

            onFilterOwnJobs: function () {
                var sCurrentUser;

                if (sap.ushell && sap.ushell.Container) {
                    sCurrentUser = sap.ushell.Container.getService("UserInfo").getId();
                } else {
                    sCurrentUser = "DEV-244";
                    console.warn("Đang chạy Local: Sử dụng User giả lập: " + sCurrentUser);
                }

                var oFilter = new Filter("CreatedBy", FilterOperator.EQ, sCurrentUser);

                var oMacroTable = this.byId("Table");

                if (!oMacroTable) {
                    return;
                }

                var oInnerTable = oMacroTable.getContent();

                var oBinding = null;

                if (oInnerTable) {
                    oBinding = oInnerTable.getBinding("rows") || oInnerTable.getBinding("items");
                }

                if (!oBinding && oInnerTable && oInnerTable.isA("sap.ui.mdc.Table")) {
                    if (typeof oInnerTable.getRowBinding === "function") {
                        oBinding = oInnerTable.getRowBinding();
                    }
                }

                if (oBinding) {
                    var oFilter = new Filter("CreatedBy", FilterOperator.EQ, sCurrentUser); // Sửa "CreatedBy" cho đúng field

                    oBinding.filter(oFilter, "Application");

                } else {

                }
            },

            onShowJobLog: function () {
                var oTable = this.byId("Table");
                var aSelectedContexts = oTable.getSelectedContexts();

                if (aSelectedContexts.length === 0) {
                    MessageToast.show("Please select a job.");
                    return;
                }

                var oContext = aSelectedContexts[0];
                var sJobName = oContext.getProperty("JobName");
                var sJobCount = oContext.getProperty("JobCount");

                // FIX: Ensure JobCount is 8 digits. Backend requires '09444500' not '9444500'.
                if (sJobCount) {
                    sJobCount = String(sJobCount).padStart(8, "0");
                }

                if (!this._pJobLogDialog) {
                    this._pJobLogDialog = Fragment.load({
                        id: this.getView().getId(),
                        name: "project5.ext.fragment.JobLog",
                        controller: this
                    }).then(function (oDialog) {
                        this.getView().addDependent(oDialog);
                        return oDialog;
                    }.bind(this));
                }

                this._pJobLogDialog.then(function (oDialog) {
                    var oLogTable = this.byId("jobLogTable");

                    // Fix lỗi template trắng trơn
                    if (!this._oLogTemplate) {
                        this._oLogTemplate = oLogTable.getBindingInfo("items").template;
                    }
                    oLogTable.unbindItems();

                    // Gửi Filter xuống ABAP
                    var aFilters = [
                        new Filter("JobName", FilterOperator.EQ, sJobName),
                        new Filter("JobCount", FilterOperator.EQ, sJobCount)
                    ];

                    oLogTable.bindItems({
                        path: "/JobLog",
                        template: this._oLogTemplate,
                        filters: aFilters
                    });

                    oDialog.setTitle("Job Log: " + sJobName + " / " + sJobCount);
                    oDialog.open();
                }.bind(this));
            },

            onCloseJobLog: function () {
                this._pJobLogDialog.then(function (oDialog) {
                    oDialog.close();
                });
            },

            onAfterRendering: function () {
                var oMacroTable = this.byId("Table");
                if (oMacroTable) {
                    // Try to wait for the macro content (which is an MDC table)
                    var oContent = oMacroTable.getContent();
                    if (oContent) {
                        // Check if it is an MDC Table and has setSelectionMode
                        if (typeof oContent.setSelectionMode === 'function') {
                            oContent.setSelectionMode("Multi");
                        }
                    }
                }
            }


            /**
             * Called when a controller is instantiated and its View controls (if available) are already created.
             * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
             * @memberOf project5.ext.main.Main
             */
            //  onInit: function () {
            //      PageController.prototype.onInit.apply(this, arguments); // needs to be called to properly initialize the page controller
            //  },

            /**
             * Similar to onAfterRendering, but this hook is invoked before the controller's View is re-rendered
             * (NOT before the first rendering! onInit() is used for that one!).
             * @memberOf project5.ext.main.Main
             */
            //  onBeforeRendering: function() {
            //
            //  },

            /**
             * Called when the View has been rendered (so its HTML is part of the document). Post-rendering manipulations of the HTML could be done here.
             * This hook is the same one that SAPUI5 controls get after being rendered.
             * @memberOf project5.ext.main.Main
             */
            //  onAfterRendering: function() {
            //
            //  },

            /**
             * Called when the Controller is destroyed. Use this one to free resources and finalize activities.
             * @memberOf project5.ext.main.Main
             */
            //  onExit: function() {
            //
            //  }
        });
    }
);
