'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import ProtectedRoute from '@/components/teacher/ProtectedRoute';
import DashboardLayout from '@/components/teacher/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import type { Achievement, AchievementCategory, AchievementRarity } from '@/types';
import {
  getAchievementsByTeacher,
  createAchievement,
  updateAchievement,
  toggleAchievementEnabled,
  seedDefaultAchievements,
  replaceDefaultAchievements
} from '@/lib/firebase/achievements';
import { 
  Plus, 
  Edit, 
  Eye, 
  EyeOff, 
  Trophy, 
  Star,
  BookOpen,
  Target,
  Users,
  Flame,
  Sparkles,
  Settings,
  Award,
  Crown,
  Medal,
  Gift,
  Calendar,
  Zap
} from 'lucide-react';

const iconMap: Record<string, React.ElementType> = {
  BookOpen,
  Star,
  Target,
  Users,
  Flame,
  Sparkles,
  Calendar,
  Zap,
  Award,
  Trophy,
  Crown,
  Medal,
  Gift
};

const categoryConfig: Record<AchievementCategory, { label: string; icon: React.ElementType; color: string }> = {
  reading: { label: 'Reading', icon: BookOpen, color: 'blue' },
  excellence: { label: 'Excellence', icon: Star, color: 'yellow' },
  participation: { label: 'Participation', icon: Users, color: 'green' },
  streaks: { label: 'Streaks', icon: Flame, color: 'orange' },
  special: { label: 'Special', icon: Sparkles, color: 'purple' }
};

const rarityConfig: Record<AchievementRarity, { color: string; bgColor: string; textColor: string }> = {
  common: { color: 'bg-gray-100', bgColor: 'bg-gray-50', textColor: 'text-gray-600' },
  rare: { color: 'bg-blue-100', bgColor: 'bg-blue-50', textColor: 'text-blue-600' },
  epic: { color: 'bg-purple-100', bgColor: 'bg-purple-50', textColor: 'text-purple-600' },
  legendary: { color: 'bg-yellow-100', bgColor: 'bg-yellow-50', textColor: 'text-yellow-600' }
};

interface AchievementCardProps {
  achievement: Achievement;
  onEdit: (achievement: Achievement) => void;
  onToggleEnabled: (achievementId: string, enabled: boolean) => void;
}

function AchievementCard({ achievement, onEdit, onToggleEnabled }: AchievementCardProps) {
  const Icon = iconMap[achievement.icon] || Award;
  const categoryInfo = categoryConfig[achievement.category];
  const rarityInfo = rarityConfig[achievement.rarity];
  
  return (
    <Card className={`transition-all duration-200 hover:shadow-lg ${!achievement.enabled ? 'opacity-60' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${rarityInfo.color}`}>
              <Icon className={`h-5 w-5 ${rarityInfo.textColor}`} />
            </div>
            <div className="flex-1">
              <CardTitle className="text-sm font-semibold">{achievement.name}</CardTitle>
              <CardDescription className="text-xs mt-1">
                {achievement.description}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggleEnabled(achievement.id, !achievement.enabled)}
              className={`p-1 rounded-full transition-colors ${
                achievement.enabled 
                  ? 'text-green-600 hover:bg-green-100' 
                  : 'text-gray-400 hover:bg-gray-100'
              }`}
            >
              {achievement.enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
            <button
              onClick={() => onEdit(achievement)}
              className="p-1 rounded-full text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <Edit className="h-4 w-4" />
            </button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <p className="text-gray-500 mb-1">Category</p>
            <div className="flex items-center gap-1">
              <categoryInfo.icon className="h-3 w-3" />
              <span className="font-medium">{categoryInfo.label}</span>
            </div>
          </div>
          <div>
            <p className="text-gray-500 mb-1">Rarity</p>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${rarityInfo.color} ${rarityInfo.textColor}`}>
              {achievement.rarity}
            </span>
          </div>
          <div>
            <p className="text-gray-500 mb-1">XP Reward</p>
            <div className="flex items-center gap-1">
              <Star className="h-3 w-3 text-blue-600" />
              <span className="font-medium">{achievement.xpReward}</span>
            </div>
          </div>
          <div>
            <p className="text-gray-500 mb-1">Grade Bonus</p>
            <div className="flex items-center gap-1">
              <Trophy className="h-3 w-3 text-green-600" />
              <span className="font-medium">
                {achievement.gradeBonus ? `+${achievement.gradeBonus}` : '0'}
              </span>
            </div>
          </div>
        </div>
        
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="text-xs text-gray-500">
            <strong>Requirement:</strong> {formatRequirement(achievement)}
          </div>
          {achievement.isDefault && (
            <div className="mt-1 text-xs text-blue-600">
              System Default
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function formatRequirement(achievement: Achievement): string {
  const req = achievement.requirements;
  
  switch (req.type) {
    case 'sections_completed':
      return `Complete ${req.value} section${req.value !== 1 ? 's' : ''} ${req.scope === 'session' ? 'in one session' : 'overall'}`;
    case 'perfect_score':
      return `Achieve ${req.value}% score ${req.scope === 'session' ? 'in one session' : 'overall average'}`;
    case 'streak_days':
      return `Maintain a ${req.value}-day learning streak`;
    case 'session_count':
      return `Participate in ${req.value} session${req.value !== 1 ? 's' : ''}`;
    case 'points_earned':
      return `Earn ${req.value} point${req.value !== 1 ? 's' : ''} ${req.scope === 'session' ? 'in one session' : 'overall'}`;
    case 'first_to_complete':
      return 'Be the first to complete a session';
    case 'response_count':
      return `Submit ${req.value} response${req.value !== 1 ? 's' : ''} ${req.scope === 'session' ? 'in one session' : 'overall'}`;
    case 'attendance_rate':
      return `Maintain ${req.value}% attendance rate`;
    case 'correct_answers':
      return `Get ${req.value} answer${req.value !== 1 ? 's' : ''} correct ${req.scope === 'session' ? 'in one session' : 'overall'}`;
    case 'highlights_created':
      return `Create ${req.value} highlight${req.value !== 1 ? 's' : ''} ${req.scope === 'session' ? 'in one session' : 'overall'}`;
    case 'response_effort':
      return `Use ${req.value} unique word${req.value !== 1 ? 's' : ''} in responses ${req.scope === 'session' ? 'in one session' : 'overall'}`;
    default:
      return 'Custom requirement';
  }
}

interface CreateAchievementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (achievement: Omit<Achievement, 'id' | 'createdAt' | 'updatedAt'>) => void;
  editingAchievement?: Achievement;
}

function CreateAchievementDialog({ isOpen, onClose, onSave, editingAchievement }: CreateAchievementDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'reading' as AchievementCategory,
    icon: 'Award',
    requirementType: 'sections_completed' as Achievement['requirements']['type'],
    requirementValue: 1,
    requirementScope: 'session' as 'session' | 'overall',
    gradeBonus: 0,
    xpReward: 10,
    rarity: 'common' as AchievementRarity,
    enabled: true
  });

  useEffect(() => {
    if (editingAchievement) {
      setFormData({
        name: editingAchievement.name,
        description: editingAchievement.description,
        category: editingAchievement.category,
        icon: editingAchievement.icon,
        requirementType: editingAchievement.requirements.type,
        requirementValue: editingAchievement.requirements.value,
        requirementScope: editingAchievement.requirements.scope || 'session',
        gradeBonus: editingAchievement.gradeBonus || 0,
        xpReward: editingAchievement.xpReward,
        rarity: editingAchievement.rarity,
        enabled: editingAchievement.enabled
      });
    } else {
      setFormData({
        name: '',
        description: '',
        category: 'reading',
        icon: 'Award',
        requirementType: 'sections_completed',
        requirementValue: 1,
        requirementScope: 'session',
        gradeBonus: 0,
        xpReward: 10,
        rarity: 'common',
        enabled: true
      });
    }
  }, [editingAchievement, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const achievement = {
      name: formData.name,
      description: formData.description,
      category: formData.category,
      icon: formData.icon,
      requirements: {
        type: formData.requirementType,
        value: formData.requirementValue,
        scope: formData.requirementScope
      },
      gradeBonus: formData.gradeBonus,
      xpReward: formData.xpReward,
      rarity: formData.rarity,
      teacherId: '', // Will be filled in the parent
      courseId: null, // Use null for Firestore compatibility
      enabled: formData.enabled,
      isDefault: false
    };
    
    onSave(achievement);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="p-6">
          <h2 className="text-xl font-semibold mb-4">
            {editingAchievement ? 'Edit Achievement' : 'Create Achievement'}
          </h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                required
              />
            </div>
            
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                rows={2}
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as AchievementCategory }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                {Object.entries(categoryConfig).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Icon</label>
              <select
                value={formData.icon}
                onChange={(e) => setFormData(prev => ({ ...prev, icon: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                {Object.keys(iconMap).map(iconName => (
                  <option key={iconName} value={iconName}>{iconName}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Requirement Type</label>
              <select
                value={formData.requirementType}
                onChange={(e) => setFormData(prev => ({ ...prev, requirementType: e.target.value as any }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="sections_completed">Sections Completed</option>
                <option value="perfect_score">Perfect Score</option>
                <option value="streak_days">Streak Days</option>
                <option value="session_count">Session Count</option>
                <option value="points_earned">Points Earned</option>
                <option value="response_count">Response Count</option>
                <option value="first_to_complete">First to Complete</option>
                <option value="attendance_rate">Attendance Rate</option>
                <option value="correct_answers">Correct Answers</option>
                <option value="highlights_created">Highlights Created</option>
                <option value="response_effort">Response Effort (Unique Words)</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Requirement Value</label>
              <input
                type="number"
                value={formData.requirementValue}
                onChange={(e) => setFormData(prev => ({ ...prev, requirementValue: parseInt(e.target.value) }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                min={1}
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Scope</label>
              <select
                value={formData.requirementScope}
                onChange={(e) => setFormData(prev => ({ ...prev, requirementScope: e.target.value as 'session' | 'overall' }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                disabled={['first_to_complete', 'streak_days', 'attendance_rate', 'session_count'].includes(formData.requirementType)}
              >
                <option value="session">Single Session</option>
                <option value="overall">Overall Progress</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Rarity</label>
              <select
                value={formData.rarity}
                onChange={(e) => setFormData(prev => ({ ...prev, rarity: e.target.value as AchievementRarity }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="common">Common</option>
                <option value="rare">Rare</option>
                <option value="epic">Epic</option>
                <option value="legendary">Legendary</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">XP Reward</label>
              <input
                type="number"
                value={formData.xpReward}
                onChange={(e) => setFormData(prev => ({ ...prev, xpReward: parseInt(e.target.value) }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                min={0}
                max={100}
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Grade Bonus (Optional)</label>
              <input
                type="number"
                value={formData.gradeBonus}
                onChange={(e) => setFormData(prev => ({ ...prev, gradeBonus: parseInt(e.target.value) }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                min={0}
                max={10}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-3 mt-6 pt-4 border-t">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) => setFormData(prev => ({ ...prev, enabled: e.target.checked }))}
                className="mr-2"
              />
              <span className="text-sm">Enabled by default</span>
            </label>
          </div>
          
          <div className="flex justify-end gap-3 mt-6">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {editingAchievement ? 'Update' : 'Create'} Achievement
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AchievementsPage() {
  const { user } = useAuth();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingAchievement, setEditingAchievement] = useState<Achievement | undefined>();
  const [selectedCategory, setSelectedCategory] = useState<AchievementCategory | 'all'>('all');

  const loadAchievements = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const data = await getAchievementsByTeacher(user.uid);
      setAchievements(data);
    } catch (error) {
      console.error('Failed to load achievements:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadAchievements();
  }, [loadAchievements]);

  const handleCreateAchievement = async (achievementData: Omit<Achievement, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!user) return;
    
    try {
      await createAchievement({
        ...achievementData,
        teacherId: user.uid
      });
      loadAchievements();
    } catch (error) {
      console.error('Failed to create achievement:', error);
    }
  };

  const handleUpdateAchievement = async (achievementData: Omit<Achievement, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!user || !editingAchievement) return;
    
    try {
      await updateAchievement(editingAchievement.id, {
        ...achievementData,
        teacherId: user.uid
      });
      loadAchievements();
      setEditingAchievement(undefined);
    } catch (error) {
      console.error('Failed to update achievement:', error);
    }
  };

  const handleToggleEnabled = async (achievementId: string, enabled: boolean) => {
    try {
      await toggleAchievementEnabled(achievementId, enabled);
      loadAchievements();
    } catch (error) {
      console.error('Failed to toggle achievement:', error);
    }
  };

  const handleSeedDefaults = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      await seedDefaultAchievements(user.uid);
      loadAchievements();
    } catch (error) {
      console.error('Failed to seed default achievements:', error);
    }
  };

  const handleReplaceDefaults = async () => {
    if (!user) return;
    
    if (!confirm('This will replace all existing default achievements with the new enhanced set. Custom achievements will be preserved. Continue?')) {
      return;
    }
    
    try {
      setLoading(true);
      await replaceDefaultAchievements(user.uid);
      loadAchievements();
    } catch (error) {
      console.error('Failed to replace default achievements:', error);
    }
  };

  const filteredAchievements = selectedCategory === 'all' 
    ? achievements 
    : achievements.filter(a => a.category === selectedCategory);

  const categories = [...new Set(achievements.map(a => a.category))];
  const stats = {
    total: achievements.length,
    enabled: achievements.filter(a => a.enabled).length,
    disabled: achievements.filter(a => !a.enabled).length,
    defaults: achievements.filter(a => a.isDefault).length
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-6 lg:p-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Achievements</h1>
                <p className="text-gray-600 mt-1">
                  Manage achievement system to motivate and reward student engagement.
                </p>
              </div>
              <div className="flex items-center gap-3">
                {achievements.length === 0 ? (
                  <Button variant="outline" onClick={handleSeedDefaults}>
                    <Settings className="h-4 w-4 mr-2" />
                    Add Default Achievements
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleSeedDefaults}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add New Defaults
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleReplaceDefaults}>
                      <Settings className="h-4 w-4 mr-2" />
                      Update All Defaults
                    </Button>
                  </div>
                )}
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Achievement
                </Button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-gray-200 rounded-lg h-48 animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                        <p className="text-sm text-gray-600">Total Achievements</p>
                      </div>
                      <Trophy className="h-8 w-8 text-yellow-500" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-green-600">{stats.enabled}</p>
                        <p className="text-sm text-gray-600">Enabled</p>
                      </div>
                      <Eye className="h-8 w-8 text-green-500" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-gray-500">{stats.disabled}</p>
                        <p className="text-sm text-gray-600">Disabled</p>
                      </div>
                      <EyeOff className="h-8 w-8 text-gray-400" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-blue-600">{stats.defaults}</p>
                        <p className="text-sm text-gray-600">System Defaults</p>
                      </div>
                      <Settings className="h-8 w-8 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Category Filter */}
              {categories.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 overflow-x-auto pb-2">
                    <button
                      onClick={() => setSelectedCategory('all')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                        selectedCategory === 'all'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      All ({achievements.length})
                    </button>
                    
                    {categories.map((category) => {
                      const config = categoryConfig[category];
                      const count = achievements.filter(a => a.category === category).length;
                      
                      return (
                        <button
                          key={category}
                          onClick={() => setSelectedCategory(category)}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                            selectedCategory === category
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          <config.icon className="h-4 w-4" />
                          {config.label} ({count})
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Achievements Grid */}
              {filteredAchievements.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-12">
                    <Award className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No achievements yet</h3>
                    <p className="text-gray-600 mb-4">
                      Create your first achievement to start motivating students.
                    </p>
                    <Button onClick={() => setShowCreateDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Achievement
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredAchievements.map((achievement) => (
                    <AchievementCard
                      key={achievement.id}
                      achievement={achievement}
                      onEdit={setEditingAchievement}
                      onToggleEnabled={handleToggleEnabled}
                    />
                  ))}
                </div>
              )}

              {/* Create/Edit Dialog */}
              <CreateAchievementDialog
                isOpen={showCreateDialog || !!editingAchievement}
                onClose={() => {
                  setShowCreateDialog(false);
                  setEditingAchievement(undefined);
                }}
                onSave={editingAchievement ? handleUpdateAchievement : handleCreateAchievement}
                editingAchievement={editingAchievement}
              />
            </>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}