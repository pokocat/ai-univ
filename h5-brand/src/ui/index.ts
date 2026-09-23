// 共享原语出口：第二阶段的屏幕一律从这里取，不各写一套
export { DieLine, CropMarks, DieFrame } from './DieLine';
export { Panel, PanelHead } from './Panel';
export type { Face } from './Panel';
export { InciList, InciRun } from './Inci';
export type { InciItem } from './Inci';
export { Stamp, SheetStamp } from './Stamp';
export type { StampKind } from './Stamp';
export { Num } from './Num';
export { Fact, FactList, PROPOSED_DISCLAIMER } from './Fact';
export { HandoffSheet, HandoffButton } from './Handoff';
export { Qr } from './Qr';
export { Blank, LoadFailure } from './States';
export { Screen, Placeholder } from './Screen';
export { Link } from './Link';
export { Icon } from './Icon';
export type { IconName } from './Icon';
