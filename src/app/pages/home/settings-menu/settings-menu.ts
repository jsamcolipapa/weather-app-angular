import {
  CdkMenu,
  CdkMenuGroup,
  CdkMenuItemCheckbox,
  CdkMenuItemRadio,
  CdkMenuTrigger,
} from '@angular/cdk/menu';
import { Component, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ALERT_IDS, ALERT_LABELS, AlertId, PrecipUnit } from '../../../models/weather.models';
import {
  ClockFormat,
  Preferences,
  PreferencesService,
} from '../../../services/preferences.service';

const CLOCKS: { value: ClockFormat; label: string }[] = [
  { value: '24h', label: '24-hour' },
  { value: '12h', label: '12-hour' },
];

const PRECIP_UNITS: { value: PrecipUnit; label: string }[] = [
  { value: 'mm', label: 'Millimetres' },
  { value: 'inch', label: 'Inches' },
];

/**
 * Header button that opens the less-often-changed settings: clock format, rain unit and which
 * alerts to be notified about.
 */
@Component({
  selector: 'app-settings-menu',
  imports: [
    CdkMenu,
    CdkMenuGroup,
    CdkMenuItemCheckbox,
    CdkMenuItemRadio,
    CdkMenuTrigger,
    MatIconModule,
  ],
  templateUrl: './settings-menu.html',
  styleUrl: './settings-menu.scss',
})
export class SettingsMenu {
  private readonly preferences = inject(PreferencesService);

  /** Whether to offer the alert choices; pointless where the browser can't notify. */
  readonly alertSettings = input(false);

  protected readonly prefs = this.preferences.prefs;
  protected readonly clocks = CLOCKS;
  protected readonly precipUnits = PRECIP_UNITS;
  protected readonly alerts = ALERT_IDS.map((id) => ({ id, label: ALERT_LABELS[id] }));

  protected set(changes: Partial<Preferences>) {
    this.preferences.update(changes);
  }

  protected toggleAlert(id: AlertId) {
    const { alerts } = this.prefs();
    this.preferences.update({ alerts: { ...alerts, [id]: !alerts[id] } });
  }
}
