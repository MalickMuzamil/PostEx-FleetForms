import { Routes } from '@angular/router';
import { AuthLayout } from './layout/auth-layout/auth-layout';
import { MainLayout } from './layout/main-layout/main-layout';
import { AuthGuard } from './core/guards/auth-guard';
import { LoginGuard } from './core/guards/login-guard';
import { PasskeyGuard } from './core/guards/passkey-guard';
import { OtpGuard } from './core/guards/otp-guard';
import { PasskeyDeactivateGuard } from './core/guards/passkey-deactivate-guard';

export const routes: Routes = [
  {
    path: 'auth',
    component: AuthLayout,
    children: [
      {
        path: 'login',
        canActivate: [LoginGuard],
        loadComponent: () =>
          import('./auth/login/login').then(m => m.LoginComponent),
      },

      {
        path: 'otp',
        canActivate: [OtpGuard],
        loadComponent: () =>
          import('./auth/otp/otp').then(m => m.OTP),
      },

      {
        path: 'passkey',
        canActivate: [PasskeyGuard],
        canDeactivate: [PasskeyDeactivateGuard],
        loadComponent: () =>
          import('./auth/passkey/passkey').then(m => m.Passkey),
      },
    ],
  },

  {
    path: '',
    component: MainLayout,
    canActivate: [AuthGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/welcome/welcome').then((m) => m.Welcome),
      },

      {
        path: 'branch-coordinator-assignment',
        loadComponent: () =>
          import(
            './features/branch-coordinator-assignment/branch-coordinator-assignment'
          ).then((m) => m.BranchCoordinatorAssignment),
      },

      {
        path: 'branch-general-employee-binding',
        loadComponent: () =>
          import(
            './features/branch-general-employee-binding/branch-general-employee-binding'
          ).then((m) => m.BranchGeneralEmployeeBinding),
      },

      {
        path: 'branch-dashboard-binding',
        loadComponent: () =>
          import(
            './features/branch-dashboard-binding-component/branch-dashboard-binding-component'
          ).then((m) => m.BranchDashboardBindingComponent),
      },

      {
        path: 'sub-branch-binding',
        loadComponent: () =>
          import('./features/sub-branch-definition/sub-branch-definition').then(
            (m) => m.SubBranchDefinitionComponent
          ),
      },

      {
        path: 'delivery-route-definition',
        loadComponent: () =>
          import(
            './features/delivery-route-definition-component/delivery-route-definition-component'
          ).then((m) => m.DeliveryRouteDefinitionComponent),
      },

      {
        path: 'delivery-route-binding/bulk-preview',
        loadComponent: () =>
          import(
            './features/delivery-route-binding-component/delivery-route-bulk-preview-component/delivery-route-bulk-preview-component'
          ).then((m) => m.DeliveryRouteBulkPreviewComponent),
      },

      {
        path: 'delivery-route-binding',
        loadComponent: () =>
          import(
            './features/delivery-route-binding-component/delivery-route-binding-component'
          ).then((m) => m.DeliveryRouteBindingComponent),
      },

      {
        path: 'sub-branch-assignment-definition',
        loadComponent: () =>
          import(
            './features/sub-branch-assignment-definition/sub-branch-assignment-definition'
          ).then((m) => m.SubBranchAssignmentDefinition),
      },

      {
        path: 'cnc-Level1',
        loadComponent: () =>
          import(
            './features/CNC-Forms/cnc-l1/cnc-l1'
          ).then((m) => m.CncL1),
      },

      {
        path: 'cnc-Level2',
        loadComponent: () =>
          import(
            './features/CNC-Forms/cnc-l2/cnc-l2'
          ).then((m) => m.CncL2),
      },

      {
        path: 'cnc-Level3',
        loadComponent: () =>
          import(
            './features/CNC-Forms/cnc-l3/cnc-l3'
          ).then((m) => m.CncL3),
      },

      {
        path: 'cnc-Level4',
        loadComponent: () =>
          import(
            './features/CNC-Forms/cnc-l4/cnc-l4'
          ).then((m) => m.CncL4),
      },

      {
        path: 'cnc-Level5',
        loadComponent: () =>
          import(
            './features/CNC-Forms/cnc-l5/cnc-l5'
          ).then((m) => m.CncL5),
      },

      {
        path: 'cnc-Level6',
        loadComponent: () =>
          import(
            './features/CNC-Forms/cnc-l6/cnc-l6'
          ).then((m) => m.CncL6),
      },

      {
        path: 'branch-to-L1',
        loadComponent: () =>
          import(
            './features/CNC-Binnding-Forms/b-l1/b-l1'
          ).then((m) => m.BL1),
      },

      {
        path: 'L1-to-L2',
        loadComponent: () =>
          import(
            './features/CNC-Binnding-Forms/b-l2/b-l2'
          ).then((m) => m.BL2),
      },

      {
        path: 'L2-to-L3',
        loadComponent: () =>
          import(
            './features/CNC-Binnding-Forms/b-l3/b-l3'
          ).then((m) => m.BL3),
      },

      {
        path: 'L3-to-L4',
        loadComponent: () =>
          import(
            './features/CNC-Binnding-Forms/b-l4/b-l4'
          ).then((m) => m.BL4),
      },

      {
        path: 'L4-to-L5',
        loadComponent: () =>
          import(
            './features/CNC-Binnding-Forms/b-l5/b-l5'
          ).then((m) => m.BL5),
      },

      {
        path: 'L5-to-L6',
        loadComponent: () =>
          import(
            './features/CNC-Binnding-Forms/b-l6/b-l6'
          ).then((m) => m.BL6),
      },

    ],
  },
];
