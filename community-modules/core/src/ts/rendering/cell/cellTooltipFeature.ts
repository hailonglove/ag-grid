import { BeanStub } from "../../context/beanStub";
import { CellCtrl, ICellComp } from "./cellCtrl";
import { Column } from "../../entities/column";
import { RowNode } from "../../entities/rowNode";
import { Beans } from "../beans";
import { escapeString } from "../../utils/string";
import { exists } from "../../utils/generic";
import { TooltipFeature, TooltipParentComp } from "../../widgets/tooltipFeature";
import { getValueUsingField } from "../../utils/object";
import { ITooltipParams } from "../tooltipComponent";

export class CellTooltipFeature extends BeanStub {

    private readonly ctrl: CellCtrl;
    private readonly column: Column;
    private readonly rowNode: RowNode;
    private readonly beans: Beans;

    private comp: ICellComp;

    private tooltip: any;
    private tooltipSanatised: string | null;

    private genericTooltipFeature: TooltipFeature;

    private browserTooltips: boolean;

    constructor(ctrl: CellCtrl, beans: Beans) {
        super();

        this.ctrl = ctrl;
        this.beans = beans;

        this.column = ctrl.getColumn();
        this.rowNode = ctrl.getRowNode();
    }

    public setComp(comp: ICellComp): void {
        this.comp = comp;
        this.setupTooltip();
    }

    private setupTooltip(): void {
        this.browserTooltips = this.beans.gridOptionsWrapper.isEnableBrowserTooltips();
        this.updateTooltipText();

        if (this.browserTooltips) {
            this.comp.setTitle(this.tooltipSanatised);
        } else {
            this.createTooltipFeatureIfNeeded();
        }
    }

    private updateTooltipText(): void {
        this.tooltip = this.getToolTip();
        this.tooltipSanatised = escapeString(this.tooltip);
    }

    private createTooltipFeatureIfNeeded(): void {
        if (this.genericTooltipFeature!=null) { return; }

        const parent: TooltipParentComp = {
            getTooltipParams: ()=> this.getTooltipParams(),
            getGui: ()=> this.ctrl.getGui()
        };

        this.genericTooltipFeature = this.createManagedBean(new TooltipFeature(parent), this.beans.context);
    }

    public refreshToolTip() {
        this.updateTooltipText();

        if (this.browserTooltips) {
            this.comp.setTitle(this.tooltipSanatised);
        }
    }

    private getToolTip(): string | null {
        const colDef = this.column.getColDef();
        const data = this.rowNode.data;

        if (colDef.tooltipField && exists(data)) {
            return getValueUsingField(data, colDef.tooltipField, this.column.isTooltipFieldContainsDots());
        }

        const valueGetter = colDef.tooltipValueGetter;

        if (valueGetter) {
            return valueGetter({
                api: this.beans.gridOptionsWrapper.getApi(),
                columnApi: this.beans.gridOptionsWrapper.getColumnApi(),
                context: this.beans.gridOptionsWrapper.getContext(),
                ...this.getTooltipParams(),
                value: this.comp.getValue()
            });
        }

        return null;
    }

    public getTooltipParams(): ITooltipParams {
        return {
            location: 'cell',
            colDef: this.column.getColDef(),
            column: this.column,
            rowIndex: this.ctrl.getCellPosition().rowIndex,
            node: this.rowNode,
            data: this.rowNode.data,
            value: this.getTooltipText(),
            valueFormatted: this.comp.getValueFormatted(),
        };
    }

    private getTooltipText(escape: boolean = true) {
        return escape ? escapeString(this.tooltip) : this.tooltip;
    }

    // overriding to make public, as we don't dispose this bean via context
    public destroy() {
        super.destroy();
    }
}