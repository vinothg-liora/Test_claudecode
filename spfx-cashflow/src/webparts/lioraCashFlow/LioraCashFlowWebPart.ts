import { Version } from '@microsoft/sp-core-library';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import {
  IPropertyPaneConfiguration,
  PropertyPaneTextField
} from '@microsoft/sp-property-pane';
import { SPComponentLoader } from '@microsoft/sp-loader';

import styles from './LioraCashFlowWebPart.module.scss';
import { getTemplate } from './template';

declare global {
  interface Window {
    LioraCashFlowInit: (rootEl: HTMLElement) => void;
    Chart: any;
    Papa: any;
    XLSX: any;
  }
}

export interface ILioraCashFlowWebPartProps {
  apiKey: string;
}

export default class LioraCashFlowWebPart extends BaseClientSideWebPart<ILioraCashFlowWebPartProps> {

  private _scriptsLoaded: boolean = false;

  public async render(): Promise<void> {
    const logoUrl: string = require('./assets/Liora_Logo_Orange_alpha.png');

    this.domElement.innerHTML = `<div class="${styles.lioraCashFlowContainer}">${getTemplate(logoUrl)}</div>`;

    if (!this._scriptsLoaded) {
      await this._loadExternalScripts();
      this._scriptsLoaded = true;
    }

    await this._loadAppScript();
    this._initApp();
  }

  private async _loadExternalScripts(): Promise<void> {
    SPComponentLoader.loadCss('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

    await SPComponentLoader.loadScript('https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js', { globalExportsName: 'Chart' });
    await SPComponentLoader.loadScript('https://cdn.jsdelivr.net/npm/chartjs-chart-treemap@2.3.0/dist/chartjs-chart-treemap.min.js', { globalExportsName: 'ChartTreemap' });
    await SPComponentLoader.loadScript('https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js', { globalExportsName: 'Papa' });
    await SPComponentLoader.loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js', { globalExportsName: 'XLSX' });
  }

  private async _loadAppScript(): Promise<void> {
    if (typeof window.LioraCashFlowInit === 'function') {
      return;
    }
    await SPComponentLoader.loadScript(
      require('./CashFlowApp.js'),
      { globalExportsName: 'LioraCashFlowInit' }
    );
  }

  private _initApp(): void {
    const container = this.domElement.querySelector(`.${styles.lioraCashFlowContainer}`) as HTMLElement;
    if (container && typeof window.LioraCashFlowInit === 'function') {
      window.LioraCashFlowInit(container);
    }
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: {
            description: 'Configuration du Cash Flow Analyzer'
          },
          groups: [
            {
              groupName: 'Paramètres',
              groupFields: [
                PropertyPaneTextField('apiKey', {
                  label: 'Clé API Claude (optionnel)',
                  description: 'Utilisée pour les suggestions IA dans Data Quality',
                  multiline: false
                })
              ]
            }
          ]
        }
      ]
    };
  }
}
