import React, { useState } from 'react';
import { Project, User, Task } from '@shared/types/models';
import { dataService } from '../services/dataService';
import { FolderKanban, Plus, Users, CheckCircle2, Clock, X, Trash2, UserPlus } from 'lucide-react';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { ManageProjectMembersModal } from './ManageProjectMembersModal';

interface ProjectsViewProps {
  projects: Project[];
  tasks: Task[];
  currentUser: User;
  onSelectProject: (projectId: string) => void;
  onRefresh: () => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects,
  tasks,
  currentUser,
  onSelectProject,
  onRefresh,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [projectForMembers, setProjectForMembers] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const users = dataService.getUsers().filter((u) => u.status === 'ACTIVE');

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const res = dataService.createProject(name, description, [currentUser.uid]);
    if (!res.success) {
      alert(res.error);
    } else {
      setName('');
      setDescription('');
      setShowCreateModal(false);
      onRefresh();
    }
  };

  const handleConfirmDeleteProject = () => {
    if (!projectToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    const res = dataService.softDeleteProject(projectToDelete.projectId);
    setIsDeleting(false);
    if (!res.success) {
      setDeleteError(res.error || 'Có lỗi xảy ra khi xóa dự án.');
    } else {
      setProjectToDelete(null);
      onRefresh();
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#222]">
        <div>
          <h1 className="text-xl md:text-2xl font-serif italic text-white">Dự Án Hoạt Động</h1>
          <p className="text-xs text-[#777]">
            Quản lý các không gian làm việc và theo dõi tiến độ tổng thể của từng dự án.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 rounded bg-[#D4AF37] hover:bg-[#c49f2e] text-black text-xs font-bold uppercase tracking-wider shadow flex items-center gap-1.5 shrink-0"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Tạo Dự Án Mới</span>
        </button>
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div className="p-8 rounded-lg border border-[#222] bg-[#0C0C0C] text-center space-y-3">
          <FolderKanban className="w-10 h-10 text-[#555] mx-auto stroke-[1.5]" />
          <h3 className="text-base font-serif text-white font-medium">Chưa Có Dự Án Khả Dụng</h3>
          <p className="text-xs text-[#777] max-w-md mx-auto leading-relaxed">
            Bạn chưa thuộc bất kỳ dự án nào hoặc dự án chưa có thành viên. Bạn chỉ có thể xem và truy cập các dự án mà bạn là thành viên chính thức.
          </p>
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map((proj) => {
          const projectTasks = tasks.filter((t) => t.projectId === proj.projectId);
          const completedTasks = projectTasks.filter((t) => t.status === 'COMPLETED');
          const completionPct = projectTasks.length > 0 ? Math.round((completedTasks.length / projectTasks.length) * 100) : 0;
          const owner = dataService.getUserById(proj.ownerId);
          const canDeleteProject = currentUser.role === 'ADMIN' || currentUser.uid === proj.ownerId;
          const memberCount = proj.members ? Object.keys(proj.members).length : 1;

          return (
            <div
              key={proj.projectId}
              onClick={() => onSelectProject(proj.projectId)}
              className="p-5 rounded border border-[#222] bg-[#0C0C0C] hover:bg-[#121212] hover:border-[#D4AF37]/40 transition-all cursor-pointer flex flex-col justify-between space-y-4 group shadow-lg relative"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FolderKanban className="w-4 h-4 text-[#D4AF37]" />
                    <span className="text-xs font-mono text-[#D4AF37] bg-[#D4AF37]/10 px-1.5 py-0.5 rounded border border-[#D4AF37]/20">
                      {proj.projectId}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#666]">
                      Trưởng dự án: {owner?.displayName || 'Admin'}
                    </span>
                    {canDeleteProject && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteError(null);
                          setProjectToDelete(proj);
                        }}
                        className="p-1.5 rounded hover:bg-rose-950/50 text-[#666] hover:text-rose-400 transition-colors z-10"
                        title="Xóa dự án"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <h3 className="text-base font-semibold text-white group-hover:text-[#D4AF37] transition-colors">
                  {proj.name}
                </h3>
                <p className="text-xs text-[#777] line-clamp-2">{proj.description}</p>
              </div>

              {/* Stats */}
              <div className="space-y-2 pt-2 border-t border-[#1a1a1a]">
                <div className="flex justify-between text-xs text-[#888]">
                  <span>Tiến độ hoàn thành:</span>
                  <span className="font-mono text-white font-medium">{completionPct}% ({completedTasks.length}/{projectTasks.length} việc)</span>
                </div>
                <div className="w-full h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#D4AF37] rounded-full transition-all"
                    style={{ width: `${completionPct}%` }}
                  ></div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#666] pt-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setProjectForMembers(proj);
                    }}
                    className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#161616] hover:bg-[#202020] border border-[#2a2a2a] hover:border-[#D4AF37]/40 text-[#bbb] hover:text-[#D4AF37] transition-all z-10"
                    title="Xem và cấp quyền thành viên cho dự án"
                  >
                    <UserPlus className="w-3 h-3 text-[#D4AF37]" />
                    <span>{memberCount} thành viên (Cấp quyền)</span>
                  </button>
                  <span className="text-[#D4AF37] group-hover:underline">Xem công việc &rarr;</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-[#0E0E0E] border border-[#333] rounded-lg shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#222]">
              <h2 className="text-base font-serif text-white font-semibold flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-[#D4AF37]" />
                <span>Thêm Dự Án Mới</span>
              </h2>
              <button onClick={() => setShowCreateModal(false)} className="text-[#888] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wider text-[#888]">Tên Dự Án *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Triển Khai Hạ Tầng Singapore..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-[#141414] border border-[#2c2c2c] text-xs text-white placeholder-[#555] focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wider text-[#888]">Mô Tả</label>
                <textarea
                  rows={3}
                  placeholder="Mô tả mục tiêu dự án..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-[#141414] border border-[#2c2c2c] text-xs text-white placeholder-[#555] focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="pt-3 border-t border-[#222] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded border border-[#333] text-xs text-[#888] hover:text-white"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-[#D4AF37] hover:bg-[#c49f2e] text-black text-xs font-bold uppercase tracking-wider"
                >
                  Tạo Dự Án
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Project Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(projectToDelete)}
        title="Xác Nhận Xóa Dự Án"
        itemName={projectToDelete?.name || ''}
        itemType="dự án"
        warningMessage="Toàn bộ các công việc trực thuộc dự án này cũng sẽ bị xóa khỏi danh sách hoạt động và lưu vào nhật ký kiểm toán."
        errorMessage={deleteError}
        isDeleting={isDeleting}
        onConfirm={handleConfirmDeleteProject}
        onClose={() => {
          if (!isDeleting) {
            setProjectToDelete(null);
            setDeleteError(null);
          }
        }}
      />
      {/* Manage Project Members Modal */}
      {projectForMembers && (
        <ManageProjectMembersModal
          project={projectForMembers}
          currentUser={currentUser}
          isOpen={Boolean(projectForMembers)}
          onClose={() => setProjectForMembers(null)}
          onUpdated={() => {
            onRefresh();
          }}
        />
      )}
    </div>
  );
};
