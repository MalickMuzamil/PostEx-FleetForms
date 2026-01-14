import { Routes } from '@angular/router';
import { AuthLayout } from './layout/auth-layout/auth-layout';
import { MainLayout } from './layout/main-layout/main-layout';
import { AuthGuard } from './core/guards/auth-guard';

export const routes: Routes = [
  {
    path: 'auth',
    component: AuthLayout,
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./auth/login/login').then((m) => m.LoginComponent),
      },
      {
        path: 'signup',
        loadComponent: () =>
          import('./auth/signup/signup').then((m) => m.Signup),
      },
    ],
  },

  {
    path: '',
    component: MainLayout,
    // canActivate: [AuthGuard],
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
      
    ],
  },
];
