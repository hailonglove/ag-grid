import { ICellRendererAngularComp } from '@ag-grid-community/angular';
import { ICellRendererParams } from '@ag-grid-community/core';
import { Component } from '@angular/core';

@Component({
    standalone: true,
    template: `<h1 class="custom-detail" style="padding: 20px;">{{ pinned }}</h1>`,
})
export class DetailCellRenderer implements ICellRendererAngularComp {
    public pinned!: string;

    agInit(params: ICellRendererParams): void {
        this.pinned = params.pinned ? params.pinned : 'center';
    }

    refresh(params: ICellRendererParams): boolean {
        return false;
    }
}
