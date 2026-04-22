import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth-service';
import { ReportsService } from '../../core/services/reports-service';
import { Table } from '../../ui/table/table';
import { REPORTS_TABLE } from './reports-config';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, Table],
  templateUrl: './reports.html',
  styleUrl: './reports.css',
})
export class Reports implements OnInit {
  tableConfig = REPORTS_TABLE;
  tableData: any[] = [];
  loading: boolean = true;
  errorMessage: string = '';
  branchAccessInfo: any = null;

  constructor(
    private reportsService: ReportsService,
    private router: Router,
    private notification: NzNotificationService,
    private auth: AuthService
  ) { }

  ngOnInit(): void {
    this.verifyUser();
  }

  verifyUser(): void {
    this.loading = true;
    this.errorMessage = '';

    const userStr = localStorage.getItem('postex.user');
    let email = '';

    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        email = user?.email || '';
      } catch {
        email = localStorage.getItem('auth.email') || '';
      }
    } else {
      email = localStorage.getItem('auth.email') || '';
    }

    if (!email) {
      this.errorMessage = 'No email found in local storage';
      this.loading = false;
      this.notification.error('Error', 'No email found in local storage');
      return;
    }

    this.reportsService.verifyUser(email).subscribe({
      next: (res: any) => {
        this.loading = false;
        
        console.log('User verified:', res);
        
        // Check if user is blocked
        if (res.user && res.user.Login_Blocked) {
          this.tableData = [{
            name: res.user.Login_Name || '-',
            email: res.user.Login_EMail || '-',
            phone: res.user.MobileNo || '-',
            role: res.user.Login_Role || '-',
            verificationStatus: 'Blocked',
            branchScenario: '-',
            branchCount: 0,
            totalBranches: 0,
            isAllBranches: 'No',
          }];
          this.notification.error('Blocked', 'User is blocked');
          return;
        }

        // If verified and has branch access, show in table
        if (res.verified && res.user && res.branchAccess && res.branchAccess.scenario !== 'NO_BRANCH_ACCESS') {
          this.branchAccessInfo = res.branchAccess;

          this.tableData = [{
            name: res.user.Login_Name || '-',
            email: res.user.Login_EMail || '-',
            phone: res.user.MobileNo || '-',
            role: res.user.Login_Role || '-',
            verificationStatus: 'Verified',
            branchScenario: res.branchAccess.scenario || '-',
            branchCount: res.branchAccess.branches?.length || 0,
            totalBranches: res.branchAccess.totalBranches || 0,
            isAllBranches: res.branchAccess.isAllBranches ? 'Yes' : 'No',
          }];

          this.notification.success('Success', 'User is verified with branch access');
        } else {
          // No branch access - don't show in table
          this.tableData = [];
          this.notification.warning('No Branch Access', 'User has no branch access');
        }
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err?.error?.message || 'Verification failed';
        this.tableData = [];
        console.error('Verification error:', err);
        this.notification.error('Error', this.errorMessage);
      },
    });
  }
}