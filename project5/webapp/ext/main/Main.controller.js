sap.ui.define(
    [
        'sap/fe/core/PageController',
        "sap/m/MessageToast",
        "sap/m/MessageBox",
        "sap/ui/core/UIComponent",
        "sap/ui/model/Filter",
        "sap/ui/model/FilterOperator",
        "sap/ui/core/Fragment",
        "sap/ui/model/json/JSONModel"
    ],
    function (PageController, MessageToast, MessageBox, UIComponent, Filter, FilterOperator, Fragment, JSONModel) {
        'use strict';

        return PageController.extend('project5.ext.main.Main', {

            // ==================== STOP JOB (với Confirmation) ====================
            onStopJob: function () {
                var oTable = this.byId("Table");
                var aSelectedContexts = oTable.getSelectedContexts();

                if (aSelectedContexts.length === 0) {
                    MessageToast.show("Vui lòng chọn ít nhất 1 Job để dừng.");
                    return;
                }

                var iCount = aSelectedContexts.length;
                var sMessage = "Bạn có chắc chắn muốn DỪNG " + iCount + " job đã chọn?";

                var that = this;
                MessageBox.confirm(sMessage, {
                    title: "🚫 Xác nhận Stop Job",
                    emphasizedAction: MessageBox.Action.OK,
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.OK) {
                            that._executeAction(aSelectedContexts, "com.sap.gateway.srvd.z_sd_job_ovp.v0001.StopJob", "Stop");
                        }
                    }
                });
            },

            // ==================== DELETE JOB (với Confirmation) ====================
            onDeleteJob: function () {
                var oTable = this.byId("Table");
                var aSelectedContexts = oTable.getSelectedContexts();

                if (aSelectedContexts.length === 0) {
                    MessageToast.show("Vui lòng chọn ít nhất 1 Job để xóa.");
                    return;
                }

                var iCount = aSelectedContexts.length;
                var aJobNames = aSelectedContexts.map(function(ctx) { return ctx.getProperty("JobName"); });
                var sMessage = "Bạn có chắc chắn muốn XÓA " + iCount + " job?\n\n" + aJobNames.join(", ");

                var that = this;
                MessageBox.confirm(sMessage, {
                    title: "🗑️ Xác nhận Delete Job",
                    emphasizedAction: MessageBox.Action.OK,
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.OK) {
                            that._executeAction(aSelectedContexts, "com.sap.gateway.srvd.z_sd_job_ovp.v0001.DeleteJob", "Delete");
                        }
                    }
                });
            },

            // ==================== HELPER: Gọi Bound Action cho nhiều dòng ====================
            _executeAction: function (aContexts, sActionName, sLabel) {
                var that = this;
                var aPromises = aContexts.map(function (oContext) {
                    var oActionContext = oContext.getModel().bindContext(
                        sActionName + "(...)", oContext
                    );
                    return oActionContext.execute().then(function () {
                        return { success: true, name: oContext.getProperty("JobName") };
                    }).catch(function (oError) {
                        return { success: false, name: oContext.getProperty("JobName"), error: oError.message };
                    });
                });

                Promise.all(aPromises).then(function (aResults) {
                    var aSuccess = aResults.filter(function (r) { return r.success; });
                    var aFailed = aResults.filter(function (r) { return !r.success; });

                    if (aSuccess.length > 0) {
                        MessageToast.show(sLabel + " thành công: " + aSuccess.length + " job(s).");
                    }
                    if (aFailed.length > 0) {
                        var sErrors = aFailed.map(function (r) { return r.name + ": " + r.error; }).join("\n");
                        MessageBox.error(sLabel + " thất bại:\n" + sErrors);
                    }

                    // Refresh bảng sau khi thực hiện
                    var oTable = that.byId("Table");
                    if (oTable) {
                        var oContent = oTable.getContent();
                        if (oContent) {
                            var oBinding = oContent.getBinding("rows") || oContent.getBinding("items");
                            if (!oBinding && typeof oContent.getRowBinding === "function") {
                                oBinding = oContent.getRowBinding();
                            }
                            if (oBinding) {
                                oBinding.refresh();
                            }
                        }
                    }
                });
            },

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
            // --- THÊM HÀM NÀY ĐỂ ĐIỀU HƯỚNG SANG TRANG DETAIL (GIỐNG SM37) ---
            onRowPress: function (oEvent) {
                var oContext = oEvent.getParameters().bindingContext || oEvent.getSource().getBindingContext();
                if (!oContext) {
                    return;
                }

                var oExtensionAPI = this.getExtensionAPI();
                if (oExtensionAPI && oExtensionAPI.routing) {
                    
                    // 1. Lấy đường dẫn Context (Path)
                    // Ví dụ sPath: "/JobList(JobName='BJSM_TEST',JobCount='000001')"
                    var sPath = oContext.getPath();
                    
                    // 2. Tách lấy phần Key nằm trong ngoặc đơn
                    var sKey = sPath.substring(sPath.indexOf("(") + 1, sPath.indexOf(")"));

                    // 3. Điều hướng sang Object Page đã khai báo trong manifest.json
                    // Tên route "JobListObjectPage" và biến "JobListKey" phải khớp với manifest
                    oExtensionAPI.routing.navigateToRoute("JobListObjectPage", {
                        "JobListKey": sKey
                    });
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
